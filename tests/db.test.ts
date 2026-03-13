import { Miniflare } from "miniflare";
import {
  insertSession,
  getSessionById,
  getLastSession,
  deleteSessionById,
  insertBatch,
  getHistory,
  getGlobalStats,
  getPeriodStats,
  calculateStreak,
  getConfig,
  setConfig,
  getPrayerCache,
  setPrayerCache,
  markPrayerSent,
  getTodayInTimezone,
  addDays,
  getWeekBounds,
  getMonthBounds,
} from "../src/services/db";
import type { PrayerTimes } from "../src/services/db";

const SCHEMA_STATEMENTS = [
  "CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, duration_seconds INTEGER NOT NULL, surah_start INTEGER NOT NULL, ayah_start INTEGER NOT NULL, surah_end INTEGER NOT NULL, ayah_end INTEGER NOT NULL, ayah_count INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')))",
  "CREATE INDEX idx_sessions_started_at ON sessions(started_at)",
  "CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "INSERT INTO config (key, value) VALUES ('city', 'Playa del Carmen')",
  "INSERT INTO config (key, value) VALUES ('country', 'MX')",
  "INSERT INTO config (key, value) VALUES ('timezone', 'America/Cancun')",
  "CREATE TABLE prayer_cache (date TEXT PRIMARY KEY, fajr TEXT NOT NULL, dhuhr TEXT NOT NULL, asr TEXT NOT NULL, maghrib TEXT NOT NULL, isha TEXT NOT NULL, fajr_sent INTEGER DEFAULT 0, dhuhr_sent INTEGER DEFAULT 0, asr_sent INTEGER DEFAULT 0, maghrib_sent INTEGER DEFAULT 0, isha_sent INTEGER DEFAULT 0, fetched_at TEXT DEFAULT (datetime('now')))",
];

const DROP_STATEMENTS = [
  "DROP TABLE IF EXISTS sessions",
  "DROP INDEX IF EXISTS idx_sessions_started_at",
  "DROP TABLE IF EXISTS config",
  "DROP TABLE IF EXISTS prayer_cache",
];

let mf: Miniflare;
let db: D1Database;

beforeEach(async () => {
  mf = new Miniflare({
    modules: true,
    d1Databases: ["DB"],
    script: "",
  });
  db = await mf.getD1Database("DB");

  // Drop everything for a clean slate, then apply full schema
  await db.batch(DROP_STATEMENTS.map((s) => db.prepare(s)));
  await db.batch(SCHEMA_STATEMENTS.map((s) => db.prepare(s)));
});

afterEach(async () => {
  await mf.dispose();
});

// --- Helper to create a session data object ---

function makeSession(overrides: Partial<{
  startedAt: string;
  durationSeconds: number;
  surahStart: number;
  ayahStart: number;
  surahEnd: number;
  ayahEnd: number;
  ayahCount: number;
}> = {}) {
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
    const session = await insertSession(db, makeSession());
    expect(session.id).toBe(1);
    expect(session.startedAt).toBe("2026-03-10 13:30:00");
    expect(session.durationSeconds).toBe(533);
    expect(session.surahStart).toBe(2);
    expect(session.ayahStart).toBe(77);
    expect(session.surahEnd).toBe(2);
    expect(session.ayahEnd).toBe(83);
    expect(session.ayahCount).toBe(7);
    expect(session.createdAt).toBeDefined();
  });

  it("auto-increments IDs", async () => {
    const s1 = await insertSession(db, makeSession());
    const s2 = await insertSession(db, makeSession({ startedAt: "2026-03-11 10:00:00" }));
    expect(s1.id).toBe(1);
    expect(s2.id).toBe(2);
  });
});

// --- getSessionById ---

describe("getSessionById", () => {
  it("returns an existing session", async () => {
    const inserted = await insertSession(db, makeSession());
    const found = await getSessionById(db, inserted.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(inserted.id);
    expect(found!.ayahCount).toBe(7);
  });

  it("returns null for a non-existent ID", async () => {
    const found = await getSessionById(db, 999);
    expect(found).toBeNull();
  });
});

// --- getLastSession ---

describe("getLastSession", () => {
  it("returns the most recent session by started_at", async () => {
    await insertSession(db, makeSession({ startedAt: "2026-03-09 08:00:00" }));
    await insertSession(db, makeSession({ startedAt: "2026-03-11 10:00:00" }));
    await insertSession(db, makeSession({ startedAt: "2026-03-10 13:30:00" }));

    const last = await getLastSession(db);
    expect(last).not.toBeNull();
    expect(last!.startedAt).toBe("2026-03-11 10:00:00");
  });

  it("returns null when no sessions exist", async () => {
    const last = await getLastSession(db);
    expect(last).toBeNull();
  });
});

// --- deleteSessionById ---

describe("deleteSessionById", () => {
  it("returns true when a session is deleted", async () => {
    const session = await insertSession(db, makeSession());
    const deleted = await deleteSessionById(db, session.id);
    expect(deleted).toBe(true);

    const found = await getSessionById(db, session.id);
    expect(found).toBeNull();
  });

  it("returns false for a non-existent ID", async () => {
    const deleted = await deleteSessionById(db, 999);
    expect(deleted).toBe(false);
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
    const count = await insertBatch(db, sessions);
    expect(count).toBe(3);

    const history = await getHistory(db);
    expect(history).toHaveLength(3);
  });

  it("returns 0 for an empty array", async () => {
    const count = await insertBatch(db, []);
    expect(count).toBe(0);
  });
});

// --- getHistory ---

describe("getHistory", () => {
  it("returns sessions ordered by started_at DESC", async () => {
    await insertSession(db, makeSession({ startedAt: "2026-03-09 08:00:00" }));
    await insertSession(db, makeSession({ startedAt: "2026-03-11 10:00:00" }));
    await insertSession(db, makeSession({ startedAt: "2026-03-10 13:30:00" }));

    const history = await getHistory(db);
    expect(history[0].startedAt).toBe("2026-03-11 10:00:00");
    expect(history[1].startedAt).toBe("2026-03-10 13:30:00");
    expect(history[2].startedAt).toBe("2026-03-09 08:00:00");
  });

  it("respects the limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      await insertSession(db, makeSession({ startedAt: `2026-03-${String(i + 1).padStart(2, "0")} 08:00:00` }));
    }
    const history = await getHistory(db, 3);
    expect(history).toHaveLength(3);
  });

  it("defaults to 10 results", async () => {
    for (let i = 0; i < 15; i++) {
      await insertSession(db, makeSession({ startedAt: `2026-03-${String(i + 1).padStart(2, "0")} 08:00:00` }));
    }
    const history = await getHistory(db);
    expect(history).toHaveLength(10);
  });

  it("returns empty array when no sessions exist", async () => {
    const history = await getHistory(db);
    expect(history).toEqual([]);
  });
});

// --- getGlobalStats ---

describe("getGlobalStats", () => {
  it("returns correct sums and averages", async () => {
    await insertSession(db, makeSession({ ayahCount: 10, durationSeconds: 600 }));
    await insertSession(db, makeSession({ ayahCount: 20, durationSeconds: 1200, startedAt: "2026-03-11 10:00:00" }));

    const stats = await getGlobalStats(db);
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalAyahs).toBe(30);
    expect(stats.totalSeconds).toBe(1800);
    expect(stats.avgAyahsPerSession).toBe(15);
    expect(stats.avgSecondsPerSession).toBe(900);
  });

  it("returns zeros when no sessions exist", async () => {
    const stats = await getGlobalStats(db);
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalAyahs).toBe(0);
    expect(stats.totalSeconds).toBe(0);
    expect(stats.avgAyahsPerSession).toBe(0);
    expect(stats.avgSecondsPerSession).toBe(0);
  });

  it("rounds averages correctly", async () => {
    await insertSession(db, makeSession({ ayahCount: 10, durationSeconds: 100 }));
    await insertSession(db, makeSession({ ayahCount: 11, durationSeconds: 101, startedAt: "2026-03-11 10:00:00" }));
    await insertSession(db, makeSession({ ayahCount: 12, durationSeconds: 102, startedAt: "2026-03-12 10:00:00" }));

    const stats = await getGlobalStats(db);
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
    await insertSession(db, makeSession({ startedAt: `${start} 10:00:00`, ayahCount: 15, durationSeconds: 300 }));
    // Session outside this week (far in the past)
    await insertSession(db, makeSession({ startedAt: "2020-01-01 10:00:00", ayahCount: 50, durationSeconds: 1000 }));

    const stats = await getPeriodStats(db, "week", "America/Cancun");
    expect(stats.sessions).toBe(1);
    expect(stats.ayahs).toBe(15);
    expect(stats.seconds).toBe(300);
  });

  it("filters sessions within the current month", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const { start } = getMonthBounds(today);

    await insertSession(db, makeSession({ startedAt: `${start} 10:00:00`, ayahCount: 20, durationSeconds: 400 }));
    await insertSession(db, makeSession({ startedAt: "2020-06-15 10:00:00", ayahCount: 50, durationSeconds: 1000 }));

    const stats = await getPeriodStats(db, "month", "America/Cancun");
    expect(stats.sessions).toBe(1);
    expect(stats.ayahs).toBe(20);
    expect(stats.seconds).toBe(400);
  });

  it("returns zeros when no sessions match the period", async () => {
    await insertSession(db, makeSession({ startedAt: "2020-01-01 10:00:00" }));

    const stats = await getPeriodStats(db, "week", "America/Cancun");
    expect(stats.sessions).toBe(0);
    expect(stats.ayahs).toBe(0);
    expect(stats.seconds).toBe(0);
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
    await insertSession(db, makeSession({ startedAt: `${today} 10:00:00` }));

    const result = await calculateStreak(db, "America/Cancun");
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(1);
  });

  it("counts consecutive days correctly", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const d1 = addDays(today, -1);
    const d2 = addDays(today, -2);

    await insertSession(db, makeSession({ startedAt: `${today} 10:00:00` }));
    await insertSession(db, makeSession({ startedAt: `${d1} 10:00:00` }));
    await insertSession(db, makeSession({ startedAt: `${d2} 10:00:00` }));

    const result = await calculateStreak(db, "America/Cancun");
    expect(result.currentStreak).toBe(3);
    expect(result.bestStreak).toBe(3);
  });

  it("tracks best streak greater than current streak", async () => {
    const today = getTodayInTimezone("America/Cancun");

    // Past streak of 3 consecutive days (far in the past)
    await insertSession(db, makeSession({ startedAt: "2025-01-01 10:00:00" }));
    await insertSession(db, makeSession({ startedAt: "2025-01-02 10:00:00" }));
    await insertSession(db, makeSession({ startedAt: "2025-01-03 10:00:00" }));

    // Current streak of 1 (today only)
    await insertSession(db, makeSession({ startedAt: `${today} 10:00:00` }));

    const result = await calculateStreak(db, "America/Cancun");
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(3);
  });

  it("counts multiple sessions on the same day as 1", async () => {
    const today = getTodayInTimezone("America/Cancun");
    await insertSession(db, makeSession({ startedAt: `${today} 08:00:00` }));
    await insertSession(db, makeSession({ startedAt: `${today} 14:00:00` }));
    await insertSession(db, makeSession({ startedAt: `${today} 20:00:00` }));

    const result = await calculateStreak(db, "America/Cancun");
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(1);
  });

  it("starts current streak from yesterday if no session today", async () => {
    const today = getTodayInTimezone("America/Cancun");
    const yesterday = addDays(today, -1);
    const dayBefore = addDays(today, -2);

    await insertSession(db, makeSession({ startedAt: `${yesterday} 10:00:00` }));
    await insertSession(db, makeSession({ startedAt: `${dayBefore} 10:00:00` }));

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
    expect(cached!.date).toBe("2026-03-13");
    expect(cached!.fajr).toBe("05:30");
    expect(cached!.dhuhr).toBe("12:15");
    expect(cached!.asr).toBe("15:45");
    expect(cached!.maghrib).toBe("18:30");
    expect(cached!.isha).toBe("20:00");
    expect(cached!.fajr_sent).toBe(0);
    expect(cached!.dhuhr_sent).toBe(0);
  });

  it("returns null for a non-cached date", async () => {
    const cached = await getPrayerCache(db, "2020-01-01");
    expect(cached).toBeNull();
  });

  it("marks a prayer as sent", async () => {
    await setPrayerCache(db, sampleTimes);
    await markPrayerSent(db, "2026-03-13", "fajr");

    const cached = await getPrayerCache(db, "2026-03-13");
    expect(cached!.fajr_sent).toBe(1);
    expect(cached!.dhuhr_sent).toBe(0);
  });

  it("overwrites prayer cache on re-insert", async () => {
    await setPrayerCache(db, sampleTimes);
    await setPrayerCache(db, { ...sampleTimes, fajr: "05:45" });

    const cached = await getPrayerCache(db, "2026-03-13");
    expect(cached!.fajr).toBe("05:45");
  });

  it("rejects invalid prayer names at runtime", async () => {
    await setPrayerCache(db, sampleTimes);
    await expect(
      markPrayerSent(db, "2026-03-13", "invalid" as any),
    ).rejects.toThrow("Invalid prayer name");
  });
});

// --- Helper functions ---

describe("helper functions", () => {
  it("getTodayInTimezone returns YYYY-MM-DD format", () => {
    const today = getTodayInTimezone("America/Cancun");
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
