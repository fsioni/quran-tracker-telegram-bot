import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { getConfig, setConfig } from "../src/services/db/config";
import {
  addDays,
  getMonthBounds,
  getTodayInTimezone,
  getWeekBounds,
} from "../src/services/db/date-helpers";
import {
  getKahfSessionsThisWeek,
  getKahfStats,
  getLastWeekKahfTotal,
} from "../src/services/db/kahf";
import { getKhatmaCount, insertKhatma } from "../src/services/db/khatma";
import {
  cleanOldCache,
  getPrayerCache,
  markPrayerSent,
  setPrayerCache,
} from "../src/services/db/prayer";
import {
  deleteSessionById,
  getHistory,
  getLastSession,
  getSessionById,
  getSessionCount,
  insertBatch,
  insertSession,
} from "../src/services/db/sessions";
import { get7DayTypeAvgSpeed } from "../src/services/db/speed";
import {
  calculateStreak,
  getGlobalStats,
  getPeriodStats,
  getPreviousWeekStats,
  getRecentPace,
  getStatsByType,
} from "../src/services/db/stats";
import type { PrayerTimes, SessionType } from "../src/services/db/types";

const DATE_FORMAT_RE = /^\d{4}-\d{2}-\d{2}$/;

import type { Result } from "../src/types";

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected ok result, got error: ${result.error}`);
  }
  return result.value;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaSQL = readFileSync(resolve(__dirname, "../schema.sql"), "utf-8");
const schemaStatements = schemaSQL
  .split(";")
  .map((s: string) => s.trim())
  .filter((s: string) => s.length > 0);

let mf: Miniflare;
let db: D1Database;

beforeEach(async () => {
  mf = new Miniflare({
    modules: true,
    d1Databases: ["DB"],
    script: "",
  });
  db = await mf.getD1Database("DB");

  await db.batch(schemaStatements.map((s: string) => db.prepare(s)));
});

afterEach(async () => {
  await mf.dispose();
});

// --- Helper to create a session data object ---

function makeSession(
  overrides: Partial<{
    startedAt: string;
    durationSeconds: number;
    surahStart: number;
    ayahStart: number;
    surahEnd: number;
    ayahEnd: number;
    ayahCount: number;
    type: SessionType;
    pageStart: number;
    pageEnd: number;
  }> = {}
) {
  return {
    startedAt: "2026-03-10 13:30:00",
    durationSeconds: 533,
    surahStart: 2,
    ayahStart: 77,
    surahEnd: 2,
    ayahEnd: 83,
    ayahCount: 7,
    ...overrides,
  };
}

// --- insertSession ---

describe("insertSession", () => {
  it("inserts and returns a session with an ID", async () => {
    const result = await insertSession(db, makeSession());
    expect(result.ok).toBe(true);
    const session = unwrap(result);
    expect(session.id).toBe(1);
    expect(session.startedAt).toBe("2026-03-10 13:30:00");
    expect(session.durationSeconds).toBe(533);
    expect(session.surahStart).toBe(2);
    expect(session.ayahStart).toBe(77);
    expect(session.surahEnd).toBe(2);
    expect(session.ayahEnd).toBe(83);
    expect(session.ayahCount).toBe(7);
    expect(session.type).toBe("normal");
    expect(session.pageStart).toBeNull();
    expect(session.pageEnd).toBeNull();
    expect(session.createdAt).toBeDefined();
  });

  it("auto-increments IDs", async () => {
    const s1 = unwrap(await insertSession(db, makeSession()));
    const s2 = unwrap(
      await insertSession(db, makeSession({ startedAt: "2026-03-11 10:00:00" }))
    );
    expect(s1.id).toBe(1);
    expect(s2.id).toBe(2);
  });

  it("stores type normal/extra/kahf correctly", async () => {
    const s1 = unwrap(await insertSession(db, makeSession({ type: "normal" })));
    const s2 = unwrap(
      await insertSession(
        db,
        makeSession({ type: "extra", startedAt: "2026-03-11 10:00:00" })
      )
    );
    const s3 = unwrap(
      await insertSession(
        db,
        makeSession({ type: "kahf", startedAt: "2026-03-12 10:00:00" })
      )
    );
    expect(s1.type).toBe("normal");
    expect(s2.type).toBe("extra");
    expect(s3.type).toBe("kahf");
  });

  it("defaults type to normal when not provided", async () => {
    const session = unwrap(await insertSession(db, makeSession()));
    expect(session.type).toBe("normal");
  });

  it("stores pageStart and pageEnd correctly", async () => {
    const session = unwrap(
      await insertSession(db, makeSession({ pageStart: 5, pageEnd: 7 }))
    );
    expect(session.pageStart).toBe(5);
    expect(session.pageEnd).toBe(7);
  });

  it("sets pageStart and pageEnd to null when not provided", async () => {
    const session = unwrap(await insertSession(db, makeSession()));
    expect(session.pageStart).toBeNull();
    expect(session.pageEnd).toBeNull();
  });
});

// --- getSessionById ---

describe("getSessionById", () => {
  it("returns an existing session", async () => {
    const inserted = unwrap(await insertSession(db, makeSession()));
    const found = await getSessionById(db, inserted.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(inserted.id);
    expect(found?.ayahCount).toBe(7);
  });

  it("returns null for a non-existent ID", async () => {
    const found = await getSessionById(db, 999);
    expect(found).toBeNull();
  });
});

// --- getLastSession ---

describe("getLastSession", () => {
  it("returns the most recent session by started_at", async () => {
    unwrap(
      await insertSession(db, makeSession({ startedAt: "2026-03-09 08:00:00" }))
    );
    unwrap(
      await insertSession(db, makeSession({ startedAt: "2026-03-11 10:00:00" }))
    );
    unwrap(
      await insertSession(db, makeSession({ startedAt: "2026-03-10 13:30:00" }))
    );

    const last = await getLastSession(db);
    expect(last).not.toBeNull();
    expect(last?.startedAt).toBe("2026-03-11 10:00:00");
  });

  it("returns null when no sessions exist", async () => {
    const last = await getLastSession(db);
    expect(last).toBeNull();
  });

  it("filters by type when provided", async () => {
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-11 10:00:00", type: "normal" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-10 10:00:00", type: "kahf" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-09 10:00:00", type: "extra" })
      )
    );

    const lastKahf = await getLastSession(db, "kahf");
    expect(lastKahf).not.toBeNull();
    expect(lastKahf?.startedAt).toBe("2026-03-10 10:00:00");
    expect(lastKahf?.type).toBe("kahf");

    const lastExtra = await getLastSession(db, "extra");
    expect(lastExtra).not.toBeNull();
    expect(lastExtra?.startedAt).toBe("2026-03-09 10:00:00");
    expect(lastExtra?.type).toBe("extra");
  });

  it("returns all types when type is not provided", async () => {
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-09 10:00:00", type: "kahf" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-11 10:00:00", type: "normal" })
      )
    );

    const last = await getLastSession(db);
    expect(last).not.toBeNull();
    expect(last?.startedAt).toBe("2026-03-11 10:00:00");
    expect(last?.type).toBe("normal");
  });
});

// --- deleteSessionById ---

describe("deleteSessionById", () => {
  it("returns the deleted session", async () => {
    const session = unwrap(await insertSession(db, makeSession()));
    const deleted = await deleteSessionById(db, session.id);
    expect(deleted).not.toBeNull();
    expect(deleted?.id).toBe(session.id);

    const found = await getSessionById(db, session.id);
    expect(found).toBeNull();
  });

  it("returns null for a non-existent ID", async () => {
    const deleted = await deleteSessionById(db, 999);
    expect(deleted).toBeNull();
  });
});

// --- insertBatch ---

describe("insertBatch", () => {
  it("inserts multiple sessions and returns the count", async () => {
    const sessions = [
      makeSession({ startedAt: "2026-03-09 08:00:00" }),
      makeSession({ startedAt: "2026-03-10 10:00:00" }),
      makeSession({ startedAt: "2026-03-11 12:00:00" }),
    ];
    const result = await insertBatch(db, sessions);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe(3);

    const history = await getHistory(db);
    expect(history).toHaveLength(3);
  });

  it("returns 0 for an empty array", async () => {
    const result = await insertBatch(db, []);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe(0);
  });
});

// --- getHistory ---

describe("getHistory", () => {
  it("returns sessions ordered by started_at DESC", async () => {
    unwrap(
      await insertSession(db, makeSession({ startedAt: "2026-03-09 08:00:00" }))
    );
    unwrap(
      await insertSession(db, makeSession({ startedAt: "2026-03-11 10:00:00" }))
    );
    unwrap(
      await insertSession(db, makeSession({ startedAt: "2026-03-10 13:30:00" }))
    );

    const history = await getHistory(db);
    expect(history[0].startedAt).toBe("2026-03-11 10:00:00");
    expect(history[1].startedAt).toBe("2026-03-10 13:30:00");
    expect(history[2].startedAt).toBe("2026-03-09 08:00:00");
  });

  it("respects the limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      unwrap(
        await insertSession(
          db,
          makeSession({
            startedAt: `2026-03-${String(i + 1).padStart(2, "0")} 08:00:00`,
          })
        )
      );
    }
    const history = await getHistory(db, 3);
    expect(history).toHaveLength(3);
  });

  it("defaults to 10 results", async () => {
    for (let i = 0; i < 15; i++) {
      unwrap(
        await insertSession(
          db,
          makeSession({
            startedAt: `2026-03-${String(i + 1).padStart(2, "0")} 08:00:00`,
          })
        )
      );
    }
    const history = await getHistory(db);
    expect(history).toHaveLength(10);
  });

  it("returns empty array when no sessions exist", async () => {
    const history = await getHistory(db);
    expect(history).toEqual([]);
  });

  it("filters by type when provided", async () => {
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-09 08:00:00", type: "normal" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-10 08:00:00", type: "kahf" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-11 08:00:00", type: "extra" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-12 08:00:00", type: "kahf" })
      )
    );

    const kahfHistory = await getHistory(db, 10, "kahf");
    expect(kahfHistory).toHaveLength(2);
    expect(kahfHistory.every((s) => s.type === "kahf")).toBe(true);
  });

  it("returns all types when type is not provided", async () => {
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-09 08:00:00", type: "normal" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-10 08:00:00", type: "kahf" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-11 08:00:00", type: "extra" })
      )
    );

    const allHistory = await getHistory(db);
    expect(allHistory).toHaveLength(3);
  });
});

// --- getSessionCount ---

describe("getSessionCount", () => {
  it("returns 0 when no sessions exist", async () => {
    expect(await getSessionCount(db)).toBe(0);
  });

  it("returns total count without type filter", async () => {
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-09 08:00:00", type: "normal" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-10 08:00:00", type: "kahf" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-11 08:00:00", type: "extra" })
      )
    );
    expect(await getSessionCount(db)).toBe(3);
  });

  it("returns filtered count when type is provided", async () => {
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-09 08:00:00", type: "normal" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-10 08:00:00", type: "kahf" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2026-03-11 08:00:00", type: "kahf" })
      )
    );
    expect(await getSessionCount(db, "kahf")).toBe(2);
    expect(await getSessionCount(db, "normal")).toBe(1);
    expect(await getSessionCount(db, "extra")).toBe(0);
  });
});

// --- getKahfSessionsThisWeek ---

describe("getKahfSessionsThisWeek", () => {
  it("returns only kahf sessions from the current week", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const { start } = getWeekBounds(today);

    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: `${start} 10:00:00`, type: "kahf" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: `${start} 14:00:00`, type: "normal" })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: `${start} 18:00:00`, type: "kahf" })
      )
    );

    const kahfSessions = await getKahfSessionsThisWeek(db, "America/Cancun");
    expect(kahfSessions).toHaveLength(2);
    expect(kahfSessions.every((s) => s.type === "kahf")).toBe(true);
  });

  it("excludes sessions from other weeks", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const { start } = getWeekBounds(today);

    // This week
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: `${start} 10:00:00`, type: "kahf" })
      )
    );
    // Far in the past
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: "2020-01-06 10:00:00", type: "kahf" })
      )
    );

    const kahfSessions = await getKahfSessionsThisWeek(db, "America/Cancun");
    expect(kahfSessions).toHaveLength(1);
    expect(kahfSessions[0].startedAt).toBe(`${start} 10:00:00`);
  });
});

// --- getLastWeekKahfTotal ---

describe("getLastWeekKahfTotal", () => {
  it("returns sum of durations from last week kahf sessions", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const lastWeekDay = addDays(today, -7);
    const { start } = getWeekBounds(lastWeekDay);

    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${start} 10:00:00`,
          type: "kahf",
          durationSeconds: 300,
        })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${start} 14:00:00`,
          type: "kahf",
          durationSeconds: 200,
        })
      )
    );
    // Normal session last week (should not count)
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${start} 18:00:00`,
          type: "normal",
          durationSeconds: 1000,
        })
      )
    );

    const total = unwrap(await getLastWeekKahfTotal(db, "America/Cancun"));
    expect(total).toBe(500);
  });

  it("returns 0 when no kahf sessions last week", async () => {
    const total = unwrap(await getLastWeekKahfTotal(db, "America/Cancun"));
    expect(total).toBe(0);
  });
});

// --- getKahfStats ---

describe("getKahfStats", () => {
  it("returns last kahf session duration and date", async () => {
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: "2026-03-09 10:00:00",
          type: "kahf",
          durationSeconds: 300,
        })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: "2026-03-11 14:00:00",
          type: "kahf",
          durationSeconds: 450,
        })
      )
    );

    const stats = await getKahfStats(db);
    expect(stats.lastDuration).toBe(450);
    expect(stats.lastDate).toBe("2026-03-11");
  });

  it("returns nulls when no kahf sessions exist", async () => {
    // Insert a normal session to make sure it's ignored
    unwrap(await insertSession(db, makeSession({ type: "normal" })));

    const stats = await getKahfStats(db);
    expect(stats.lastDuration).toBeNull();
    expect(stats.lastDate).toBeNull();
  });
});

// --- getStatsByType ---

describe("getStatsByType", () => {
  it("returns stats filtered by type", async () => {
    unwrap(
      await insertSession(
        db,
        makeSession({ type: "kahf", ayahCount: 10, durationSeconds: 300 })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({
          type: "kahf",
          ayahCount: 20,
          durationSeconds: 600,
          startedAt: "2026-03-11 10:00:00",
        })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({
          type: "normal",
          ayahCount: 50,
          durationSeconds: 1000,
          startedAt: "2026-03-12 10:00:00",
        })
      )
    );

    const kahfStats = unwrap(await getStatsByType(db, "kahf"));
    expect(kahfStats.totalSessions).toBe(2);
    expect(kahfStats.totalAyahs).toBe(30);
    expect(kahfStats.totalSeconds).toBe(900);
    expect(kahfStats.avgAyahsPerSession).toBe(15);
    expect(kahfStats.avgSecondsPerSession).toBe(450);

    const normalStats = unwrap(await getStatsByType(db, "normal"));
    expect(normalStats.totalSessions).toBe(1);
    expect(normalStats.totalAyahs).toBe(50);
    expect(normalStats.totalSeconds).toBe(1000);
  });

  it("returns zeros when no sessions of that type exist", async () => {
    unwrap(await insertSession(db, makeSession({ type: "normal" })));

    const extraStats = unwrap(await getStatsByType(db, "extra"));
    expect(extraStats.totalSessions).toBe(0);
    expect(extraStats.totalAyahs).toBe(0);
    expect(extraStats.totalSeconds).toBe(0);
    expect(extraStats.avgAyahsPerSession).toBe(0);
    expect(extraStats.avgSecondsPerSession).toBe(0);
  });
});

// --- getGlobalStats ---

describe("getGlobalStats", () => {
  it("returns correct sums and averages", async () => {
    unwrap(
      await insertSession(
        db,
        makeSession({ ayahCount: 10, durationSeconds: 600 })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({
          ayahCount: 20,
          durationSeconds: 1200,
          startedAt: "2026-03-11 10:00:00",
        })
      )
    );

    const stats = unwrap(await getGlobalStats(db));
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalAyahs).toBe(30);
    expect(stats.totalSeconds).toBe(1800);
    expect(stats.avgAyahsPerSession).toBe(15);
    expect(stats.avgSecondsPerSession).toBe(900);
  });

  it("returns zeros when no sessions exist", async () => {
    const stats = unwrap(await getGlobalStats(db));
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalAyahs).toBe(0);
    expect(stats.totalSeconds).toBe(0);
    expect(stats.avgAyahsPerSession).toBe(0);
    expect(stats.avgSecondsPerSession).toBe(0);
  });

  it("rounds averages correctly", async () => {
    unwrap(
      await insertSession(
        db,
        makeSession({ ayahCount: 10, durationSeconds: 100 })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({
          ayahCount: 11,
          durationSeconds: 101,
          startedAt: "2026-03-11 10:00:00",
        })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({
          ayahCount: 12,
          durationSeconds: 102,
          startedAt: "2026-03-12 10:00:00",
        })
      )
    );

    const stats = unwrap(await getGlobalStats(db));
    // avg ayahs = 33/3 = 11
    expect(stats.avgAyahsPerSession).toBe(11);
    // avg seconds = 303/3 = 101
    expect(stats.avgSecondsPerSession).toBe(101);
  });
});

// --- getPeriodStats ---

describe("getPeriodStats", () => {
  it("filters sessions within the current week", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const { start } = getWeekBounds(today);

    // Session within this week
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${start} 10:00:00`,
          ayahCount: 15,
          durationSeconds: 300,
        })
      )
    );
    // Session outside this week (far in the past)
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: "2020-01-01 10:00:00",
          ayahCount: 50,
          durationSeconds: 1000,
        })
      )
    );

    const stats = unwrap(await getPeriodStats(db, "week", "America/Cancun"));
    expect(stats.sessions).toBe(1);
    expect(stats.ayahs).toBe(15);
    expect(stats.seconds).toBe(300);
  });

  it("filters sessions within the current month", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const { start } = getMonthBounds(today);

    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${start} 10:00:00`,
          ayahCount: 20,
          durationSeconds: 400,
        })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: "2020-06-15 10:00:00",
          ayahCount: 50,
          durationSeconds: 1000,
        })
      )
    );

    const stats = unwrap(await getPeriodStats(db, "month", "America/Cancun"));
    expect(stats.sessions).toBe(1);
    expect(stats.ayahs).toBe(20);
    expect(stats.seconds).toBe(400);
  });

  it("returns zeros when no sessions match the period", async () => {
    unwrap(
      await insertSession(db, makeSession({ startedAt: "2020-01-01 10:00:00" }))
    );

    const stats = unwrap(await getPeriodStats(db, "week", "America/Cancun"));
    expect(stats.sessions).toBe(0);
    expect(stats.ayahs).toBe(0);
    expect(stats.seconds).toBe(0);
  });
});

// --- Kahf partial page adjustment in stats ---

describe("Kahf partial page adjustment", () => {
  it("adjusts pages for kahf session starting at page 293 in getGlobalStats", async () => {
    const today = getTodayInTimezone("America/Cancun");
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 10:00:00`,
          type: "kahf",
          pageStart: 293,
          pageEnd: 293,
          durationSeconds: 600,
        })
      )
    );

    const stats = unwrap(await getGlobalStats(db));
    // 1 raw page -> 4/15 effective
    expect(stats.totalPages).toBeCloseTo(4 / 15);
  });

  it("adjusts pages for kahf multi-page session in getPeriodStats", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const { start } = getWeekBounds(today);
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${start} 10:00:00`,
          type: "kahf",
          pageStart: 293,
          pageEnd: 295,
          durationSeconds: 1200,
        })
      )
    );

    const stats = unwrap(await getPeriodStats(db, "week", "America/Cancun"));
    // 3 raw pages -> 2 + 4/15 effective
    expect(stats.pages).toBeCloseTo(2 + 4 / 15);
  });

  it("does not adjust pages for normal session at page 293", async () => {
    const today = getTodayInTimezone("America/Cancun");
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 10:00:00`,
          type: "normal",
          pageStart: 293,
          pageEnd: 295,
          durationSeconds: 600,
        })
      )
    );

    const stats = unwrap(await getGlobalStats(db));
    expect(stats.totalPages).toBe(3);
  });

  it("does not adjust pages for kahf session not starting at 293", async () => {
    const today = getTodayInTimezone("America/Cancun");
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 10:00:00`,
          type: "kahf",
          pageStart: 294,
          pageEnd: 296,
          durationSeconds: 600,
        })
      )
    );

    const stats = unwrap(await getGlobalStats(db));
    expect(stats.totalPages).toBe(3);
  });
});

// --- calculateStreak ---

describe("calculateStreak", () => {
  it("returns 0/0 when no sessions exist", async () => {
    const result = await calculateStreak(db, "America/Cancun");
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(0);
  });

  it("returns 1 when only today has a session", async () => {
    const today = getTodayInTimezone("America/Cancun");
    unwrap(
      await insertSession(db, makeSession({ startedAt: `${today} 10:00:00` }))
    );

    const result = await calculateStreak(db, "America/Cancun");
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(1);
  });

  it("counts consecutive days correctly", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const d1 = addDays(today, -1);
    const d2 = addDays(today, -2);

    unwrap(
      await insertSession(db, makeSession({ startedAt: `${today} 10:00:00` }))
    );
    unwrap(
      await insertSession(db, makeSession({ startedAt: `${d1} 10:00:00` }))
    );
    unwrap(
      await insertSession(db, makeSession({ startedAt: `${d2} 10:00:00` }))
    );

    const result = await calculateStreak(db, "America/Cancun");
    expect(result.currentStreak).toBe(3);
    expect(result.bestStreak).toBe(3);
  });

  it("tracks best streak greater than current streak", async () => {
    const today = getTodayInTimezone("America/Cancun");

    // Past streak of 3 consecutive days (far in the past)
    unwrap(
      await insertSession(db, makeSession({ startedAt: "2025-01-01 10:00:00" }))
    );
    unwrap(
      await insertSession(db, makeSession({ startedAt: "2025-01-02 10:00:00" }))
    );
    unwrap(
      await insertSession(db, makeSession({ startedAt: "2025-01-03 10:00:00" }))
    );

    // Current streak of 1 (today only)
    unwrap(
      await insertSession(db, makeSession({ startedAt: `${today} 10:00:00` }))
    );

    const result = await calculateStreak(db, "America/Cancun");
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(3);
  });

  it("counts multiple sessions on the same day as 1", async () => {
    const today = getTodayInTimezone("America/Cancun");
    unwrap(
      await insertSession(db, makeSession({ startedAt: `${today} 08:00:00` }))
    );
    unwrap(
      await insertSession(db, makeSession({ startedAt: `${today} 14:00:00` }))
    );
    unwrap(
      await insertSession(db, makeSession({ startedAt: `${today} 20:00:00` }))
    );

    const result = await calculateStreak(db, "America/Cancun");
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(1);
  });

  it("starts current streak from yesterday if no session today", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const yesterday = addDays(today, -1);
    const dayBefore = addDays(today, -2);

    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: `${yesterday} 10:00:00` })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: `${dayBefore} 10:00:00` })
      )
    );

    const result = await calculateStreak(db, "America/Cancun");
    expect(result.currentStreak).toBe(2);
    expect(result.bestStreak).toBe(2);
  });
});

// --- getConfig / setConfig ---

describe("getConfig / setConfig", () => {
  it("returns a seeded config value", async () => {
    const city = await getConfig(db, "city");
    expect(city).toBe("Playa del Carmen");
  });

  it("returns null for a non-existent key", async () => {
    const val = await getConfig(db, "nonexistent");
    expect(val).toBeNull();
  });

  it("updates an existing config value", async () => {
    await setConfig(db, "city", "Cancun");
    const city = await getConfig(db, "city");
    expect(city).toBe("Cancun");
  });

  it("inserts a new config key", async () => {
    await setConfig(db, "new_key", "new_value");
    const val = await getConfig(db, "new_key");
    expect(val).toBe("new_value");
  });
});

// --- Prayer cache ---

describe("prayerCache", () => {
  const sampleTimes: PrayerTimes = {
    date: "2026-03-13",
    fajr: "05:30",
    dhuhr: "12:15",
    asr: "15:45",
    maghrib: "18:30",
    isha: "20:00",
  };

  it("sets and gets prayer cache", async () => {
    await setPrayerCache(db, sampleTimes);
    const cached = await getPrayerCache(db, "2026-03-13");

    expect(cached).not.toBeNull();
    expect(cached?.date).toBe("2026-03-13");
    expect(cached?.fajr).toBe("05:30");
    expect(cached?.dhuhr).toBe("12:15");
    expect(cached?.asr).toBe("15:45");
    expect(cached?.maghrib).toBe("18:30");
    expect(cached?.isha).toBe("20:00");
    expect(cached?.fajr_sent).toBe(0);
    expect(cached?.dhuhr_sent).toBe(0);
  });

  it("returns null for a non-cached date", async () => {
    const cached = await getPrayerCache(db, "2020-01-01");
    expect(cached).toBeNull();
  });

  it("marks a prayer as sent", async () => {
    await setPrayerCache(db, sampleTimes);
    await markPrayerSent(db, "2026-03-13", "fajr");

    const cached = await getPrayerCache(db, "2026-03-13");
    expect(cached?.fajr_sent).toBe(1);
    expect(cached?.dhuhr_sent).toBe(0);
  });

  it("overwrites prayer times but preserves sent flags on upsert", async () => {
    await setPrayerCache(db, sampleTimes);
    await markPrayerSent(db, "2026-03-13", "fajr");

    // Re-insert with updated fajr time
    await setPrayerCache(db, { ...sampleTimes, fajr: "05:45" });

    const cached = await getPrayerCache(db, "2026-03-13");
    expect(cached?.fajr).toBe("05:45");
    // Sent flag must be preserved (not reset to 0)
    expect(cached?.fajr_sent).toBe(1);
  });

  it("rejects invalid prayer names at runtime", async () => {
    await setPrayerCache(db, sampleTimes);
    await expect(
      markPrayerSent(db, "2026-03-13", "invalid" as any)
    ).rejects.toThrow("Invalid prayer name");
  });
});

// --- Helper functions ---

describe("helper functions", () => {
  it("getTodayInTimezone returns YYYY-MM-DD format", () => {
    const today = getTodayInTimezone("America/Cancun");
    expect(today).toMatch(DATE_FORMAT_RE);
  });

  it("addDays adds positive days", () => {
    expect(addDays("2026-03-10", 3)).toBe("2026-03-13");
  });

  it("addDays subtracts negative days", () => {
    expect(addDays("2026-03-10", -5)).toBe("2026-03-05");
  });

  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-03-30", 5)).toBe("2026-04-04");
  });

  it("getWeekBounds returns Monday to Sunday", () => {
    // 2026-03-13 is a Friday
    const bounds = getWeekBounds("2026-03-13");
    expect(bounds.start).toBe("2026-03-09"); // Monday
    expect(bounds.end).toBe("2026-03-15"); // Sunday
  });

  it("getWeekBounds handles Sunday", () => {
    // 2026-03-15 is a Sunday
    const bounds = getWeekBounds("2026-03-15");
    expect(bounds.start).toBe("2026-03-09"); // Monday
    expect(bounds.end).toBe("2026-03-15"); // Sunday
  });

  it("getMonthBounds returns first to last day", () => {
    const bounds = getMonthBounds("2026-03-13");
    expect(bounds.start).toBe("2026-03-01");
    expect(bounds.end).toBe("2026-03-31");
  });

  it("getMonthBounds handles February in non-leap year", () => {
    const bounds = getMonthBounds("2026-02-10");
    expect(bounds.start).toBe("2026-02-01");
    expect(bounds.end).toBe("2026-02-28");
  });
});

// --- getRecentPace ---

describe("getRecentPace", () => {
  it("calculates pace using full 14-day window", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const d1 = addDays(today, -1);
    const d2 = addDays(today, -3);

    // 3 pages on d1, 5 pages on d2 = 8 pages total
    // Always divided by 14 days
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${d1} 10:00:00`,
          type: "normal",
          pageStart: 10,
          pageEnd: 12,
        })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${d2} 10:00:00`,
          type: "normal",
          pageStart: 13,
          pageEnd: 17,
        })
      )
    );

    const pace = await getRecentPace(db, "America/Cancun");
    expect(pace).toBeCloseTo(8 / 14);
  });

  it("uses full window when history spans all 14 days", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const d1 = addDays(today, -13); // oldest day in 14-day window

    // 5 pages on day -13 = 5 pages total / 14 days
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${d1} 10:00:00`,
          type: "normal",
          pageStart: 1,
          pageEnd: 5,
        })
      )
    );

    const pace = await getRecentPace(db, "America/Cancun");
    expect(pace).toBeCloseTo(5 / 14);
  });

  it("returns 0 when no recent sessions", async () => {
    // Session far in the past
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: "2020-01-01 10:00:00",
          type: "normal",
          pageStart: 1,
          pageEnd: 5,
        })
      )
    );

    const pace = await getRecentPace(db, "America/Cancun");
    expect(pace).toBe(0);
  });

  it("ignores extra and kahf sessions", async () => {
    const today = getTodayInTimezone("America/Cancun");

    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 10:00:00`,
          type: "extra",
          pageStart: 1,
          pageEnd: 5,
        })
      )
    );
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 12:00:00`,
          type: "kahf",
          pageStart: 293,
          pageEnd: 295,
        })
      )
    );

    const pace = await getRecentPace(db, "America/Cancun");
    expect(pace).toBe(0);
  });

  it("ignores sessions without page_start/page_end", async () => {
    const today = getTodayInTimezone("America/Cancun");

    unwrap(
      await insertSession(
        db,
        makeSession({ startedAt: `${today} 10:00:00`, type: "normal" })
      )
    );

    const pace = await getRecentPace(db, "America/Cancun");
    expect(pace).toBe(0);
  });
});

// --- cleanOldCache ---

describe("cleanOldCache", () => {
  const makeTimes = (date: string): PrayerTimes => ({
    date,
    fajr: "05:30",
    dhuhr: "12:15",
    asr: "15:45",
    maghrib: "18:30",
    isha: "20:00",
  });

  it("supprime les entrees de plus de 7 jours", async () => {
    await setPrayerCache(db, makeTimes("2026-03-01")); // 13 jours avant le 14
    await setPrayerCache(db, makeTimes("2026-03-10")); // 4 jours avant
    await setPrayerCache(db, makeTimes("2026-03-14")); // aujourd'hui

    await cleanOldCache(db, "2026-03-14");

    expect(await getPrayerCache(db, "2026-03-01")).toBeNull();
    expect(await getPrayerCache(db, "2026-03-10")).not.toBeNull();
    expect(await getPrayerCache(db, "2026-03-14")).not.toBeNull();
  });
});

// --- getPreviousWeekStats ---

describe("getPreviousWeekStats", () => {
  it("returns stats from previous week only", async () => {
    // Today is Wednesday 2026-03-18 -> current week Mon 16 - Sun 22
    // Previous week: Mon 9 - Sun 15
    await insertSession(
      db,
      makeSession({
        startedAt: "2026-03-10 10:00:00", // prev week (Tue)
        ayahCount: 50,
        durationSeconds: 1200,
      })
    );
    await insertSession(
      db,
      makeSession({
        startedAt: "2026-03-17 10:00:00", // current week (Mon)
        ayahCount: 30,
        durationSeconds: 600,
      })
    );

    const result = await getPreviousWeekStats(db, "UTC", "2026-03-18");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ayahs).toBe(50);
      expect(result.value.seconds).toBe(1200);
      expect(result.value.sessions).toBe(1);
    }
  });

  it("returns zeros when no sessions in previous week", async () => {
    const result = await getPreviousWeekStats(db, "UTC", "2026-03-18");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ayahs).toBe(0);
      expect(result.value.seconds).toBe(0);
      expect(result.value.sessions).toBe(0);
    }
  });
});

// --- insertKhatma / getKhatmaCount ---

describe("insertKhatma / getKhatmaCount", () => {
  it("inserts a khatma and returns id and completedAt", async () => {
    const khatma = await insertKhatma(db, "2026-03-15 14:00:00");
    expect(khatma.id).toBe(1);
    expect(khatma.completedAt).toBe("2026-03-15 14:00:00");
  });

  it("returns 0 when no khatmas exist", async () => {
    const count = await getKhatmaCount(db);
    expect(count).toBe(0);
  });

  it("returns correct count after multiple inserts", async () => {
    await insertKhatma(db, "2026-03-10 14:00:00");
    await insertKhatma(db, "2026-03-15 14:00:00");
    await insertKhatma(db, "2026-03-20 14:00:00");

    const count = await getKhatmaCount(db);
    expect(count).toBe(3);
  });
});

// --- get7DayTypeAvgSpeed ---

describe("get7DayTypeAvgSpeed", () => {
  it("returns null speeds when no prior sessions exist", async () => {
    const today = getTodayInTimezone("UTC");
    const s = unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 10:00:00`,
          type: "normal",
          pageStart: 1,
          pageEnd: 3,
        })
      )
    );
    const avg = await get7DayTypeAvgSpeed(db, "normal", "UTC", s.id);
    expect(avg.pagesPerHour).toBeNull();
    expect(avg.versesPerHour).toBeNull();
  });

  it("computes page speed from prior sessions", async () => {
    // Use getTodayInTimezone to get a stable "today" for the test
    const today = getTodayInTimezone("UTC");
    // Insert a prior session: 2 pages in 1800s = 4 pages/h
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 10:00:00`,
          durationSeconds: 1800,
          pageStart: 1,
          pageEnd: 2,
          type: "normal",
        })
      )
    );
    // Insert the current session
    const current = unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 14:00:00`,
          durationSeconds: 900,
          pageStart: 3,
          pageEnd: 5,
          type: "normal",
        })
      )
    );
    const avg = await get7DayTypeAvgSpeed(db, "normal", "UTC", current.id);
    expect(avg.pagesPerHour).toBeCloseTo(4, 1);
  });

  it("excludes the current session from average", async () => {
    const today = getTodayInTimezone("UTC");
    const only = unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 10:00:00`,
          durationSeconds: 1800,
          pageStart: 1,
          pageEnd: 2,
          type: "normal",
        })
      )
    );
    const avg = await get7DayTypeAvgSpeed(db, "normal", "UTC", only.id);
    expect(avg.pagesPerHour).toBeNull();
  });

  it("filters by session type", async () => {
    const today = getTodayInTimezone("UTC");
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 10:00:00`,
          durationSeconds: 1800,
          pageStart: 1,
          pageEnd: 2,
          type: "extra",
        })
      )
    );
    const current = unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 14:00:00`,
          durationSeconds: 900,
          pageStart: 3,
          pageEnd: 5,
          type: "normal",
        })
      )
    );
    // No normal sessions besides current, so should be null
    const avg = await get7DayTypeAvgSpeed(db, "normal", "UTC", current.id);
    expect(avg.pagesPerHour).toBeNull();
  });

  it("computes verses per hour for verse-only sessions", async () => {
    const today = getTodayInTimezone("UTC");
    // 7 ayahs in 1800s = 14 ayahs/h
    unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 10:00:00`,
          durationSeconds: 1800,
          ayahCount: 7,
          type: "normal",
        })
      )
    );
    const current = unwrap(
      await insertSession(
        db,
        makeSession({
          startedAt: `${today} 14:00:00`,
          durationSeconds: 900,
          ayahCount: 10,
          type: "normal",
        })
      )
    );
    const avg = await get7DayTypeAvgSpeed(db, "normal", "UTC", current.id);
    expect(avg.versesPerHour).toBeCloseTo(14, 1);
  });
});
