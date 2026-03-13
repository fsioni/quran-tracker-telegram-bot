// tests/handlers/stats.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { historyHandler, statsHandler, progressHandler } from "../../src/handlers/stats";
import type { CustomContext } from "../../src/bot";
import type { Session } from "../../src/services/db";

// Mock le module db au niveau fichier
vi.mock("../../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/db")>();
  return {
    ...actual,
    getHistory: vi.fn(),
    getGlobalStats: vi.fn(),
    getPeriodStats: vi.fn(),
    calculateStreak: vi.fn(),
    getConfig: vi.fn(),
    getLastSession: vi.fn(),
  };
});

import {
  getHistory,
  getGlobalStats,
  getPeriodStats,
  calculateStreak,
  getConfig,
  getLastSession,
} from "../../src/services/db";

function makeCtx(): CustomContext {
  return {
    reply: vi.fn().mockResolvedValue(undefined),
    db: {} as D1Database,
  } as unknown as CustomContext;
}

const MOCK_SESSION: Session = {
  id: 42,
  startedAt: "2026-03-10 13:30:00",
  durationSeconds: 533,
  surahStart: 2,
  ayahStart: 77,
  surahEnd: 2,
  ayahEnd: 83,
  ayahCount: 7,
  createdAt: "2026-03-10 13:30:00",
};

// --- historyHandler (reecrit avec vi.mock) ---

describe("historyHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repond 'Aucune session' si historique vide", async () => {
    vi.mocked(getHistory).mockResolvedValue([]);
    const ctx = makeCtx();
    await historyHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith("Aucune session enregistree.");
  });

  it("affiche une session formatee", async () => {
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION]);
    const ctx = makeCtx();
    await historyHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("#42");
    expect(msg).toContain("10/03");
    expect(msg).toContain("Al-Baqara");
    expect(msg).toContain("8m53");
  });

  it("affiche plusieurs sessions separees par newline", async () => {
    const session2 = { ...MOCK_SESSION, id: 41, ayahStart: 60, ayahEnd: 76, ayahCount: 17 };
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION, session2]);
    const ctx = makeCtx();
    await historyHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("#42");
    expect(msg).toContain("#41");
    expect(msg.split("\n")).toHaveLength(2);
  });

  it("appelle reply exactement une fois", async () => {
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION]);
    const ctx = makeCtx();
    await historyHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });
});

// --- statsHandler ---

describe("statsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les stats formatees selon la spec", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      totalSessions: 10,
      totalAyahs: 342,
      totalSeconds: 15780,
      avgAyahsPerSession: 34,
      avgSecondsPerSession: 1578,
    });
    vi.mocked(getPeriodStats)
      .mockResolvedValueOnce({ sessions: 3, ayahs: 45, seconds: 2280 })   // week
      .mockResolvedValueOnce({ sessions: 7, ayahs: 187, seconds: 8100 }); // month
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 5,
      bestStreak: 12,
    });
    vi.mocked(getConfig).mockResolvedValue(null); // default tz

    const ctx = makeCtx();
    await statsHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("-- Stats globales --");
    expect(msg).toContain("Versets lus : 342");
    expect(msg).toContain("Streak actuel : 5 jours");
    expect(msg).toContain("Meilleur streak : 12 jours");
    expect(msg).toContain("-- Cette semaine --");
    expect(msg).toContain("Versets : 45");
    expect(msg).toContain("-- Ce mois --");
    expect(msg).toContain("Versets : 187");
  });

  it("utilise le timezone par defaut si config absente", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      totalSessions: 0, totalAyahs: 0, totalSeconds: 0,
      avgAyahsPerSession: 0, avgSecondsPerSession: 0,
    });
    vi.mocked(getPeriodStats).mockResolvedValue({ sessions: 0, ayahs: 0, seconds: 0 });
    vi.mocked(calculateStreak).mockResolvedValue({ currentStreak: 0, bestStreak: 0 });
    vi.mocked(getConfig).mockResolvedValue(null);

    const ctx = makeCtx();
    await statsHandler(ctx);

    expect(getConfig).toHaveBeenCalledWith(ctx.db, "timezone");
    expect(getPeriodStats).toHaveBeenCalledWith(ctx.db, "week", "America/Cancun");
  });
});

// --- progressHandler ---

describe("progressHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche la progression avec barre et dernier point", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      totalSessions: 10,
      totalAyahs: 342,
      totalSeconds: 15780,
      avgAyahsPerSession: 34,
      avgSecondsPerSession: 1578,
    });
    vi.mocked(getLastSession).mockResolvedValue({
      id: 42,
      startedAt: "2026-03-10 13:30:00",
      durationSeconds: 533,
      surahStart: 2,
      ayahStart: 280,
      surahEnd: 3,
      ayahEnd: 10,
      ayahCount: 17,
      createdAt: "2026-03-10 13:30:00",
    });

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("342 / 6236 versets");
    expect(msg).toContain("Dernier point : sourate Al-Imran (3), verset 10");
  });

  it("affiche un message si aucune session", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      totalSessions: 0, totalAyahs: 0, totalSeconds: 0,
      avgAyahsPerSession: 0, avgSecondsPerSession: 0,
    });
    vi.mocked(getLastSession).mockResolvedValue(null);

    const ctx = makeCtx();
    await progressHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith("Aucune session enregistree.");
  });
});
