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
    getTimezone: vi.fn(),
    getLastSession: vi.fn(),
    getRecentPace: vi.fn(),
    getTodayInTimezone: vi.fn(),
    getKhatmaCount: vi.fn(),
    getPreviousWeekStats: vi.fn(),
  };
});

import {
  getHistory,
  getGlobalStats,
  getPeriodStats,
  calculateStreak,
  getConfig,
  getTimezone,
  getLastSession,
  getRecentPace,
  getTodayInTimezone,
  getKhatmaCount,
  getPreviousWeekStats,
} from "../../src/services/db";

function makeCtx(match = ""): CustomContext {
  return {
    match,
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
  type: 'normal',
  pageStart: null,
  pageEnd: null,
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

  it("affiche une session formatee avec tag type", async () => {
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION]);
    const ctx = makeCtx();
    await historyHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("[N]");
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

  it("appelle getHistory sans filtre par defaut", async () => {
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION]);
    const ctx = makeCtx();
    await historyHandler(ctx);
    expect(getHistory).toHaveBeenCalledWith(ctx.db, 10, undefined);
  });

  it("filtre par type 'extra' quand ctx.match = 'extra'", async () => {
    const extraSession = { ...MOCK_SESSION, type: 'extra' as const };
    vi.mocked(getHistory).mockResolvedValue([extraSession]);
    const ctx = makeCtx("extra");
    await historyHandler(ctx);
    expect(getHistory).toHaveBeenCalledWith(ctx.db, 10, "extra");
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("[E]");
  });

  it("filtre par type 'kahf' quand ctx.match = 'kahf'", async () => {
    const kahfSession = { ...MOCK_SESSION, type: 'kahf' as const };
    vi.mocked(getHistory).mockResolvedValue([kahfSession]);
    const ctx = makeCtx("kahf");
    await historyHandler(ctx);
    expect(getHistory).toHaveBeenCalledWith(ctx.db, 10, "kahf");
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("[K]");
  });
});

// --- statsHandler ---

describe("statsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPreviousWeekStats).mockResolvedValue({
      ok: true,
      value: { sessions: 0, ayahs: 0, seconds: 0 },
    });
  });

  it("affiche les stats formatees selon la spec", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 10,
      totalAyahs: 342,
      totalSeconds: 15780,
      avgAyahsPerSession: 34,
      avgSecondsPerSession: 1578,
    }});
    vi.mocked(getPeriodStats)
      .mockResolvedValueOnce({ ok: true, value: { sessions: 3, ayahs: 45, seconds: 2280 } })   // week
      .mockResolvedValueOnce({ ok: true, value: { sessions: 7, ayahs: 187, seconds: 8100 } }); // month
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 5,
      bestStreak: 12,
    });
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");

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
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 0, totalAyahs: 0, totalSeconds: 0,
      avgAyahsPerSession: 0, avgSecondsPerSession: 0,
    }});
    vi.mocked(getPeriodStats).mockResolvedValue({ ok: true, value: { sessions: 0, ayahs: 0, seconds: 0 } });
    vi.mocked(calculateStreak).mockResolvedValue({ currentStreak: 0, bestStreak: 0 });
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");

    const ctx = makeCtx();
    await statsHandler(ctx);

    expect(getTimezone).toHaveBeenCalledWith(ctx.db);
    expect(getPeriodStats).toHaveBeenCalledWith(ctx.db, "week", "America/Cancun");
  });

  it("affiche la tendance quand les donnees de la semaine precedente sont disponibles", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 10, totalAyahs: 342, totalSeconds: 15780,
      avgAyahsPerSession: 34, avgSecondsPerSession: 1578,
    }});
    vi.mocked(getPeriodStats)
      .mockResolvedValueOnce({ ok: true, value: { sessions: 3, ayahs: 120, seconds: 2700 } })
      .mockResolvedValueOnce({ ok: true, value: { sessions: 7, ayahs: 340, seconds: 8100 } });
    vi.mocked(calculateStreak).mockResolvedValue({ currentStreak: 5, bestStreak: 12 });
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    vi.mocked(getPreviousWeekStats).mockResolvedValue({
      ok: true,
      value: { sessions: 3, ayahs: 100, seconds: 2520 },
    });

    const ctx = makeCtx();
    await statsHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Vitesse : 160 versets/h");
    expect(msg).toContain("vs semaine derniere");
  });

  it("n'affiche pas la tendance quand getPreviousWeekStats echoue", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 10, totalAyahs: 342, totalSeconds: 15780,
      avgAyahsPerSession: 34, avgSecondsPerSession: 1578,
    }});
    vi.mocked(getPeriodStats)
      .mockResolvedValueOnce({ ok: true, value: { sessions: 3, ayahs: 120, seconds: 2700 } })
      .mockResolvedValueOnce({ ok: true, value: { sessions: 7, ayahs: 340, seconds: 8100 } });
    vi.mocked(calculateStreak).mockResolvedValue({ currentStreak: 5, bestStreak: 12 });
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    vi.mocked(getPreviousWeekStats).mockResolvedValue({
      ok: false,
      error: "db error",
    });

    const ctx = makeCtx();
    await statsHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Vitesse : 160 versets/h");
    expect(msg).not.toContain("vs semaine derniere");
  });
});

// --- progressHandler ---

describe("progressHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-15");
    vi.mocked(getRecentPace).mockResolvedValue(0);
    vi.mocked(getKhatmaCount).mockResolvedValue(0);
  });

  it("affiche la progression avec barre et dernier point", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 10,
      totalAyahs: 342,
      totalSeconds: 15780,
      avgAyahsPerSession: 34,
      avgSecondsPerSession: 1578,
    }});
    vi.mocked(getLastSession).mockResolvedValue({
      id: 42,
      startedAt: "2026-03-10 13:30:00",
      durationSeconds: 533,
      surahStart: 2,
      ayahStart: 280,
      surahEnd: 3,
      ayahEnd: 10,
      ayahCount: 17,
      type: 'normal',
      pageStart: null,
      pageEnd: null,
      createdAt: "2026-03-10 13:30:00",
    });

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("342 / 6236 versets");
    expect(msg).toContain("Dernier point : sourate Al-Imran (3), verset 10");
  });

  it("appelle getLastSession avec type 'normal'", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 1, totalAyahs: 7, totalSeconds: 533,
      avgAyahsPerSession: 7, avgSecondsPerSession: 533,
    }});
    vi.mocked(getLastSession).mockResolvedValue({ ...MOCK_SESSION });

    const ctx = makeCtx();
    await progressHandler(ctx);

    expect(getLastSession).toHaveBeenCalledWith(ctx.db, 'normal');
  });

  it("affiche la progression par page quand pageEnd est present", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 10,
      totalAyahs: 342,
      totalSeconds: 15780,
      avgAyahsPerSession: 34,
      avgSecondsPerSession: 1578,
    }});
    vi.mocked(getLastSession).mockResolvedValue({
      ...MOCK_SESSION,
      pageStart: 41,
      pageEnd: 42,
    });

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Page : 42 / 604");
  });

  it("n'affiche pas la ligne page quand pageEnd est null", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 1, totalAyahs: 7, totalSeconds: 533,
      avgAyahsPerSession: 7, avgSecondsPerSession: 533,
    }});
    vi.mocked(getLastSession).mockResolvedValue({ ...MOCK_SESSION });

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).not.toContain("Page :");
  });

  it("affiche un message si aucune session", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 0, totalAyahs: 0, totalSeconds: 0,
      avgAyahsPerSession: 0, avgSecondsPerSession: 0,
    }});
    vi.mocked(getLastSession).mockResolvedValue(null);

    const ctx = makeCtx();
    await progressHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith("Aucune session enregistree.");
  });

  it("affiche l'estimation quand pageEnd est present et pace > 0", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 10, totalAyahs: 342, totalSeconds: 15780,
      avgAyahsPerSession: 34, avgSecondsPerSession: 1578,
    }});
    vi.mocked(getLastSession).mockResolvedValue({
      ...MOCK_SESSION,
      pageStart: 41,
      pageEnd: 200,
    });
    vi.mocked(getRecentPace).mockResolvedValue(2.5);

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("A ce rythme (~2.5 pages/jour)");
    expect(msg).toContain("tu finiras vers le");
  });

  it("affiche 'pas assez de donnees' quand pace est 0", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 10, totalAyahs: 342, totalSeconds: 15780,
      avgAyahsPerSession: 34, avgSecondsPerSession: 1578,
    }});
    vi.mocked(getLastSession).mockResolvedValue({
      ...MOCK_SESSION,
      pageStart: 41,
      pageEnd: 200,
    });
    vi.mocked(getRecentPace).mockResolvedValue(0);

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Pas assez de donnees recentes pour estimer");
  });

  it("n'affiche pas d'estimation quand pageEnd == 604 (termine)", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 100, totalAyahs: 6236, totalSeconds: 50000,
      avgAyahsPerSession: 62, avgSecondsPerSession: 500,
    }});
    vi.mocked(getLastSession).mockResolvedValue({
      ...MOCK_SESSION,
      pageStart: 603,
      pageEnd: 604,
    });
    vi.mocked(getRecentPace).mockResolvedValue(2.0);

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Page : 604 / 604");
    expect(msg).not.toContain("rythme");
    expect(msg).not.toContain("finiras");
  });

  it("n'affiche pas d'estimation quand pageEnd est null", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 1, totalAyahs: 7, totalSeconds: 533,
      avgAyahsPerSession: 7, avgSecondsPerSession: 533,
    }});
    vi.mocked(getLastSession).mockResolvedValue({ ...MOCK_SESSION });

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).not.toContain("rythme");
    expect(msg).not.toContain("finiras");
  });

  it("affiche le nombre de khatmas quand > 0", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 10, totalAyahs: 342, totalSeconds: 15780,
      avgAyahsPerSession: 34, avgSecondsPerSession: 1578,
    }});
    vi.mocked(getLastSession).mockResolvedValue({ ...MOCK_SESSION });
    vi.mocked(getKhatmaCount).mockResolvedValue(2);

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Khatmas : 2");
  });

  it("n'affiche pas les khatmas quand 0", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({ ok: true, value: {
      totalSessions: 1, totalAyahs: 7, totalSeconds: 533,
      avgAyahsPerSession: 7, avgSecondsPerSession: 533,
    }});
    vi.mocked(getLastSession).mockResolvedValue({ ...MOCK_SESSION });
    vi.mocked(getKhatmaCount).mockResolvedValue(0);

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).not.toContain("Khatmas");
  });
});
