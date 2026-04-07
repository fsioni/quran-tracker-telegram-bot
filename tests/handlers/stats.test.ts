// tests/handlers/stats.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomContext } from "../../src/bot";
import {
  HISTORY_PAGE_SIZE,
  historyHandler,
  historyPageCallback,
  progressHandler,
  statsHandler,
} from "../../src/handlers/stats";
import { fr } from "../../src/locales/fr";
import type { Session } from "../../src/services/db/types";

// Mock les modules db au niveau fichier
vi.mock("../../src/services/db/date-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/date-helpers")>();
  return { ...actual, getTimezone: vi.fn(), getTodayInTimezone: vi.fn() };
});
vi.mock("../../src/services/db/khatma", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/khatma")>();
  return { ...actual, getKhatmaCount: vi.fn() };
});
vi.mock("../../src/services/db/sessions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/sessions")>();
  return {
    ...actual,
    getHistory: vi.fn(),
    getSessionCount: vi.fn(),
    getLastSession: vi.fn(),
  };
});
vi.mock("../../src/services/db/stats", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/stats")>();
  return {
    ...actual,
    getGlobalStats: vi.fn(),
    getPeriodStats: vi.fn(),
    calculateStreak: vi.fn(),
    getRecentPace: vi.fn(),
    getPreviousWeekStats: vi.fn(),
  };
});

import {
  getTimezone,
  getTodayInTimezone,
} from "../../src/services/db/date-helpers";
import { getKhatmaCount } from "../../src/services/db/khatma";
import {
  getHistory,
  getLastSession,
  getSessionCount,
} from "../../src/services/db/sessions";
import {
  calculateStreak,
  getGlobalStats,
  getPeriodStats,
  getPreviousWeekStats,
  getRecentPace,
} from "../../src/services/db/stats";

function makeCtx(match = ""): CustomContext {
  return {
    match,
    reply: vi.fn().mockResolvedValue(undefined),
    db: {} as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

function makeCallbackCtx(data: string): CustomContext {
  return {
    callbackQuery: { data },
    editMessageText: vi.fn().mockResolvedValue(undefined),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    db: {} as D1Database,
    locale: fr,
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
  type: "normal",
  pageStart: null,
  pageEnd: null,
  createdAt: "2026-03-10 13:30:00",
};

// --- historyHandler (reecrit avec vi.mock) ---

describe("historyHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionCount).mockResolvedValue(1);
  });

  it("repond 'Aucune session' si historique vide", async () => {
    vi.mocked(getHistory).mockResolvedValue([]);
    vi.mocked(getSessionCount).mockResolvedValue(0);
    const ctx = makeCtx();
    await historyHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Aucune session enregistrée.",
      undefined
    );
  });

  it("affiche une session formatee avec tag type", async () => {
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION]);
    const ctx = makeCtx();
    await historyHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("[N]");
    expect(msg).toContain("#42");
    expect(msg).toContain("10/03");
    expect(msg).toContain("Al-Baqara");
    expect(msg).toContain("8m53");
  });

  it("affiche plusieurs sessions separees par newline", async () => {
    const session2 = {
      ...MOCK_SESSION,
      id: 41,
      ayahStart: 60,
      ayahEnd: 76,
      ayahCount: 17,
    };
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION, session2]);
    vi.mocked(getSessionCount).mockResolvedValue(2);
    const ctx = makeCtx();
    await historyHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("#42");
    expect(msg).toContain("#41");
    // 2 session lines, no page indicator (count <= PAGE_SIZE)
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
    expect(getHistory).toHaveBeenCalledWith(
      ctx.db,
      HISTORY_PAGE_SIZE,
      undefined,
      0
    );
  });

  it("filtre par type 'extra' quand ctx.match = 'extra'", async () => {
    const extraSession = { ...MOCK_SESSION, type: "extra" as const };
    vi.mocked(getHistory).mockResolvedValue([extraSession]);
    const ctx = makeCtx("extra");
    await historyHandler(ctx);
    expect(getHistory).toHaveBeenCalledWith(
      ctx.db,
      HISTORY_PAGE_SIZE,
      "extra",
      0
    );
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("[E]");
  });

  it("filtre par type 'kahf' quand ctx.match = 'kahf'", async () => {
    const kahfSession = { ...MOCK_SESSION, type: "kahf" as const };
    vi.mocked(getHistory).mockResolvedValue([kahfSession]);
    const ctx = makeCtx("kahf");
    await historyHandler(ctx);
    expect(getHistory).toHaveBeenCalledWith(
      ctx.db,
      HISTORY_PAGE_SIZE,
      "kahf",
      0
    );
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("[K]");
  });

  it("pas de keyboard si <= 10 sessions", async () => {
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION]);
    vi.mocked(getSessionCount).mockResolvedValue(5);
    const ctx = makeCtx();
    await historyHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.any(String), undefined);
  });

  it("affiche keyboard Suivant si > 10 sessions", async () => {
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION]);
    vi.mocked(getSessionCount).mockResolvedValue(25);
    const ctx = makeCtx();
    await historyHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Page 1/3");
    const opts = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts).toBeDefined();
    expect(opts.reply_markup).toBeDefined();
  });
});

// --- historyPageCallback ---

describe("historyPageCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("page 2 affiche Precedent et Suivant", async () => {
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION]);
    vi.mocked(getSessionCount).mockResolvedValue(25);
    const ctx = makeCallbackCtx("hist:2");
    await historyPageCallback(ctx);
    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    const msg = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Page 2/3");
    expect(getHistory).toHaveBeenCalledWith(
      ctx.db,
      HISTORY_PAGE_SIZE,
      undefined,
      10
    );
  });

  it("derniere page n'a que le bouton Precedent", async () => {
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION]);
    vi.mocked(getSessionCount).mockResolvedValue(25);
    const ctx = makeCallbackCtx("hist:3");
    await historyPageCallback(ctx);
    const msg = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Page 3/3");
  });

  it("preserve le filtre type dans le callback", async () => {
    vi.mocked(getHistory).mockResolvedValue([
      { ...MOCK_SESSION, type: "kahf" },
    ]);
    vi.mocked(getSessionCount).mockResolvedValue(25);
    const ctx = makeCallbackCtx("hist:2:kahf");
    await historyPageCallback(ctx);
    expect(getHistory).toHaveBeenCalledWith(
      ctx.db,
      HISTORY_PAGE_SIZE,
      "kahf",
      10
    );
  });

  it("answerCallbackQuery si data invalide", async () => {
    const ctx = makeCallbackCtx("invalid");
    await historyPageCallback(ctx);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("hist:0 est rejete par la regex (answerCallbackQuery)", async () => {
    const ctx = makeCallbackCtx("hist:0");
    await historyPageCallback(ctx);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(ctx.editMessageText).not.toHaveBeenCalled();
  });

  it("page au-dela de totalPages est clampee a la derniere page", async () => {
    vi.mocked(getHistory).mockResolvedValue([MOCK_SESSION]);
    vi.mocked(getSessionCount).mockResolvedValue(25); // 3 pages
    const ctx = makeCallbackCtx("hist:999");
    await historyPageCallback(ctx);
    const msg = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Page 3/3");
  });
});

// --- statsHandler ---

describe("statsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPreviousWeekStats).mockResolvedValue({
      ok: true,
      value: { sessions: 0, ayahs: 0, pages: 0, pageSeconds: 0, seconds: 0 },
    });
  });

  it("affiche les stats formatees selon la spec", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 10,
        totalAyahs: 342,
        totalPages: 20,
        totalPageSeconds: 15_780,
        totalSeconds: 15_780,
        avgAyahsPerSession: 34,
        avgSecondsPerSession: 1578,
      },
    });
    vi.mocked(getPeriodStats)
      .mockResolvedValueOnce({
        ok: true,
        value: {
          sessions: 3,
          ayahs: 45,
          pages: 3,
          pageSeconds: 2280,
          seconds: 2280,
        },
      }) // week
      .mockResolvedValueOnce({
        ok: true,
        value: {
          sessions: 7,
          ayahs: 187,
          pages: 10,
          pageSeconds: 8100,
          seconds: 8100,
        },
      }); // month
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 5,
      bestStreak: 12,
    });
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");

    const ctx = makeCtx();
    await statsHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).not.toContain("NaN");
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
      ok: true,
      value: {
        totalSessions: 0,
        totalAyahs: 0,
        totalPages: 0,
        totalPageSeconds: 0,
        totalSeconds: 0,
        avgAyahsPerSession: 0,
        avgSecondsPerSession: 0,
      },
    });
    vi.mocked(getPeriodStats).mockResolvedValue({
      ok: true,
      value: { sessions: 0, ayahs: 0, pages: 0, pageSeconds: 0, seconds: 0 },
    });
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 0,
      bestStreak: 0,
    });
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");

    const ctx = makeCtx();
    await statsHandler(ctx);

    expect(getTimezone).toHaveBeenCalledWith(ctx.db);
    expect(getPeriodStats).toHaveBeenCalledWith(
      ctx.db,
      "week",
      "America/Cancun"
    );
  });

  it("affiche la tendance quand les donnees de la semaine precedente sont disponibles", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 10,
        totalAyahs: 342,
        totalPages: 20,
        totalPageSeconds: 15_780,
        totalSeconds: 15_780,
        avgAyahsPerSession: 34,
        avgSecondsPerSession: 1578,
      },
    });
    vi.mocked(getPeriodStats)
      .mockResolvedValueOnce({
        ok: true,
        value: {
          sessions: 3,
          ayahs: 120,
          pages: 6,
          pageSeconds: 2700,
          seconds: 2700,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          sessions: 7,
          ayahs: 340,
          pages: 10,
          pageSeconds: 8100,
          seconds: 8100,
        },
      });
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 5,
      bestStreak: 12,
    });
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    vi.mocked(getPreviousWeekStats).mockResolvedValue({
      ok: true,
      value: {
        sessions: 3,
        ayahs: 100,
        pages: 5,
        pageSeconds: 2520,
        seconds: 2520,
      },
    });

    const ctx = makeCtx();
    await statsHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).not.toContain("NaN");
    expect(msg).toContain("Vitesse : 8.0 pages/h");
    expect(msg).toContain("vs semaine dernière");
  });

  it("n'affiche pas la tendance quand getPreviousWeekStats echoue", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 10,
        totalAyahs: 342,
        totalPages: 20,
        totalPageSeconds: 15_780,
        totalSeconds: 15_780,
        avgAyahsPerSession: 34,
        avgSecondsPerSession: 1578,
      },
    });
    vi.mocked(getPeriodStats)
      .mockResolvedValueOnce({
        ok: true,
        value: {
          sessions: 3,
          ayahs: 120,
          pages: 6,
          pageSeconds: 2700,
          seconds: 2700,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          sessions: 7,
          ayahs: 340,
          pages: 10,
          pageSeconds: 8100,
          seconds: 8100,
        },
      });
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 5,
      bestStreak: 12,
    });
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    vi.mocked(getPreviousWeekStats).mockResolvedValue({
      ok: false,
      error: "db error",
    });

    const ctx = makeCtx();
    await statsHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).not.toContain("NaN");
    expect(msg).toContain("Vitesse : 8.0 pages/h");
    expect(msg).not.toContain("vs semaine dernière");
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

  it("affiche la progression avec barre sans prochaine page si pageEnd absent", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 10,
        totalAyahs: 342,
        totalSeconds: 15_780,
        avgAyahsPerSession: 34,
        avgSecondsPerSession: 1578,
      },
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
      type: "normal",
      pageStart: null,
      pageEnd: null,
      createdAt: "2026-03-10 13:30:00",
    });

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("342 / 6236 versets");
    expect(msg).not.toContain("Prochaine page");
  });

  it("appelle getLastSession avec type 'normal'", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 1,
        totalAyahs: 7,
        totalSeconds: 533,
        avgAyahsPerSession: 7,
        avgSecondsPerSession: 533,
      },
    });
    vi.mocked(getLastSession).mockResolvedValue({ ...MOCK_SESSION });

    const ctx = makeCtx();
    await progressHandler(ctx);

    expect(getLastSession).toHaveBeenCalledWith(ctx.db, "normal");
  });

  it("affiche la progression par page quand pageEnd est present", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 10,
        totalAyahs: 342,
        totalSeconds: 15_780,
        avgAyahsPerSession: 34,
        avgSecondsPerSession: 1578,
      },
    });
    vi.mocked(getLastSession).mockResolvedValue({
      ...MOCK_SESSION,
      pageStart: 41,
      pageEnd: 42,
    });

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Prochaine page : 43");
    expect(msg).toContain("Page : 42 / 604");
  });

  it("n'affiche pas la ligne page quand pageEnd est null", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 1,
        totalAyahs: 7,
        totalSeconds: 533,
        avgAyahsPerSession: 7,
        avgSecondsPerSession: 533,
      },
    });
    vi.mocked(getLastSession).mockResolvedValue({ ...MOCK_SESSION });

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).not.toContain("Page :");
    expect(msg).not.toContain("Prochaine page");
  });

  it("affiche un message si aucune session", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 0,
        totalAyahs: 0,
        totalSeconds: 0,
        avgAyahsPerSession: 0,
        avgSecondsPerSession: 0,
      },
    });
    vi.mocked(getLastSession).mockResolvedValue(null);

    const ctx = makeCtx();
    await progressHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith("Aucune session enregistrée.");
  });

  it("affiche l'estimation quand pageEnd est present et pace > 0", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 10,
        totalAyahs: 342,
        totalSeconds: 15_780,
        avgAyahsPerSession: 34,
        avgSecondsPerSession: 1578,
      },
    });
    vi.mocked(getLastSession).mockResolvedValue({
      ...MOCK_SESSION,
      pageStart: 41,
      pageEnd: 200,
    });
    vi.mocked(getRecentPace).mockResolvedValue(2.5);

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("À ce rythme (~2.5 pages/jour)");
    expect(msg).toContain("tu finiras vers le");
  });

  it("affiche 'pas assez de donnees' quand pace est 0", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 10,
        totalAyahs: 342,
        totalSeconds: 15_780,
        avgAyahsPerSession: 34,
        avgSecondsPerSession: 1578,
      },
    });
    vi.mocked(getLastSession).mockResolvedValue({
      ...MOCK_SESSION,
      pageStart: 41,
      pageEnd: 200,
    });
    vi.mocked(getRecentPace).mockResolvedValue(0);

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Pas assez de données récentes pour estimer");
  });

  it("n'affiche pas d'estimation quand pageEnd == 604 (termine)", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 100,
        totalAyahs: 6236,
        totalSeconds: 50_000,
        avgAyahsPerSession: 62,
        avgSecondsPerSession: 500,
      },
    });
    vi.mocked(getLastSession).mockResolvedValue({
      ...MOCK_SESSION,
      pageStart: 603,
      pageEnd: 604,
    });
    vi.mocked(getRecentPace).mockResolvedValue(2.0);

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Prochaine page : 1");
    expect(msg).toContain("Page : 604 / 604");
    expect(msg).not.toContain("rythme");
    expect(msg).not.toContain("finiras");
  });

  it("n'affiche pas d'estimation quand pageEnd est null", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 1,
        totalAyahs: 7,
        totalSeconds: 533,
        avgAyahsPerSession: 7,
        avgSecondsPerSession: 533,
      },
    });
    vi.mocked(getLastSession).mockResolvedValue({ ...MOCK_SESSION });

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).not.toContain("rythme");
    expect(msg).not.toContain("finiras");
  });

  it("affiche le nombre de khatmas quand > 0", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 10,
        totalAyahs: 342,
        totalSeconds: 15_780,
        avgAyahsPerSession: 34,
        avgSecondsPerSession: 1578,
      },
    });
    vi.mocked(getLastSession).mockResolvedValue({ ...MOCK_SESSION });
    vi.mocked(getKhatmaCount).mockResolvedValue(2);

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Khatmas : 2");
  });

  it("n'affiche pas les khatmas quand 0", async () => {
    vi.mocked(getGlobalStats).mockResolvedValue({
      ok: true,
      value: {
        totalSessions: 1,
        totalAyahs: 7,
        totalSeconds: 533,
        avgAyahsPerSession: 7,
        avgSecondsPerSession: 533,
      },
    });
    vi.mocked(getLastSession).mockResolvedValue({ ...MOCK_SESSION });
    vi.mocked(getKhatmaCount).mockResolvedValue(0);

    const ctx = makeCtx();
    await progressHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).not.toContain("Khatmas");
  });
});
