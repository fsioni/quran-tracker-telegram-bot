import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/db")>();
  return {
    ...actual,
    getPeriodStats: vi.fn(),
    getWeekPages: vi.fn(),
    getWeekSessions: vi.fn(),
    calculateStreak: vi.fn(),
  };
});

import { fr } from "../src/locales/fr";
import {
  calculateStreak,
  getPeriodStats,
  getWeekPages,
  getWeekSessions,
} from "../src/services/db";
import { formatWeeklyRecap } from "../src/services/format";
import type { WeeklyRecapData } from "../src/services/weekly-recap";
import { buildWeeklyRecap } from "../src/services/weekly-recap";

describe("buildWeeklyRecap", () => {
  const db = {} as D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne les bonnes données avec sessions", async () => {
    vi.mocked(getPeriodStats)
      .mockResolvedValueOnce({
        ok: true,
        value: { sessions: 5, ayahs: 100, seconds: 3000 },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { sessions: 4, ayahs: 80, seconds: 2500 },
      });
    vi.mocked(getWeekPages)
      .mockResolvedValueOnce({ ok: true, value: 12 })
      .mockResolvedValueOnce({ ok: true, value: 10 });
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 8,
      bestStreak: 15,
    });
    vi.mocked(getWeekSessions).mockResolvedValue([
      {
        id: 1,
        startedAt: "2026-03-16 10:00:00",
        durationSeconds: 600,
        pageStart: 1,
        pageEnd: 2,
        surahStart: 1,
        ayahStart: 1,
        surahEnd: 1,
        ayahEnd: 7,
        ayahCount: 7,
        type: "normal" as const,
        createdAt: "2026-03-16",
      },
    ]);

    const result = await buildWeeklyRecap(db, "America/Cancun");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.thisWeek).toEqual({
      sessions: 5,
      ayahs: 100,
      seconds: 3000,
    });
    expect(result.value.lastWeek).toEqual({
      sessions: 4,
      ayahs: 80,
      seconds: 2500,
    });
    expect(result.value.thisWeekPages).toBe(12);
    expect(result.value.lastWeekPages).toBe(10);
    expect(result.value.streak).toEqual({ currentStreak: 8, bestStreak: 15 });
    expect(result.value.completedSurahs).toHaveLength(1);
    expect(result.value.completedSurahs[0].number).toBe(1);
  });

  it("detecte les sourates complètes et deduplique", async () => {
    vi.mocked(getPeriodStats).mockResolvedValue({
      ok: true,
      value: { sessions: 2, ayahs: 50, seconds: 1000 },
    });
    vi.mocked(getWeekPages).mockResolvedValue({ ok: true, value: 5 });
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 3,
      bestStreak: 3,
    });
    vi.mocked(getWeekSessions).mockResolvedValue([
      {
        id: 1,
        startedAt: "2026-03-16 10:00:00",
        durationSeconds: 300,
        pageStart: null,
        pageEnd: null,
        surahStart: 112,
        ayahStart: 1,
        surahEnd: 112,
        ayahEnd: 4,
        ayahCount: 4,
        type: "normal" as const,
        createdAt: "2026-03-16",
      },
      {
        id: 2,
        startedAt: "2026-03-17 10:00:00",
        durationSeconds: 300,
        pageStart: null,
        pageEnd: null,
        surahStart: 112,
        ayahStart: 1,
        surahEnd: 113,
        ayahEnd: 5,
        ayahCount: 9,
        type: "normal" as const,
        createdAt: "2026-03-17",
      },
    ]);

    const result = await buildWeeklyRecap(db, "America/Cancun");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // Al-Ikhlas (112) appears in both sessions but should be deduplicated
    expect(result.value.completedSurahs).toHaveLength(2);
    const numbers = result.value.completedSurahs.map((s) => s.number);
    expect(numbers).toContain(112);
    expect(numbers).toContain(113);
  });

  it("retourne ok avec zeros quand S-1 est vide (pas d'activite)", async () => {
    vi.mocked(getPeriodStats)
      .mockResolvedValueOnce({
        ok: true,
        value: { sessions: 3, ayahs: 50, seconds: 1500 },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { sessions: 0, ayahs: 0, seconds: 0 },
      });
    vi.mocked(getWeekPages)
      .mockResolvedValueOnce({ ok: true, value: 5 })
      .mockResolvedValueOnce({ ok: true, value: 0 });
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 1,
      bestStreak: 1,
    });
    vi.mocked(getWeekSessions).mockResolvedValue([]);

    const result = await buildWeeklyRecap(db, "America/Cancun");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.lastWeek).toEqual({
      sessions: 0,
      ayahs: 0,
      seconds: 0,
    });
    expect(result.value.lastWeekPages).toBe(0);
  });

  it("propage l'erreur quand getPeriodStats echoue", async () => {
    vi.mocked(getPeriodStats)
      .mockResolvedValueOnce({
        ok: true,
        value: { sessions: 3, ayahs: 50, seconds: 1500 },
      })
      .mockResolvedValueOnce({ ok: false, error: "DB query failed" });
    vi.mocked(getWeekPages)
      .mockResolvedValueOnce({ ok: true, value: 5 })
      .mockResolvedValueOnce({ ok: true, value: 0 });
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 1,
      bestStreak: 1,
    });
    vi.mocked(getWeekSessions).mockResolvedValue([]);

    const result = await buildWeeklyRecap(db, "America/Cancun");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toBe("DB query failed");
  });

  it("propage l'erreur quand getWeekPages echoue", async () => {
    vi.mocked(getPeriodStats).mockResolvedValue({
      ok: true,
      value: { sessions: 3, ayahs: 50, seconds: 1500 },
    });
    vi.mocked(getWeekPages)
      .mockResolvedValueOnce({
        ok: false,
        error: "getWeekPages: D1 returned no row",
      })
      .mockResolvedValueOnce({ ok: true, value: 0 });
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 1,
      bestStreak: 1,
    });
    vi.mocked(getWeekSessions).mockResolvedValue([]);

    const result = await buildWeeklyRecap(db, "America/Cancun");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("getWeekPages");
  });
});

describe("formatWeeklyRecap", () => {
  it("format correct avec comparaison S-1 positive", () => {
    const data: WeeklyRecapData = {
      thisWeek: { sessions: 5, ayahs: 100, seconds: 9300 },
      lastWeek: { sessions: 4, ayahs: 80, seconds: 8000 },
      thisWeekPages: 12,
      lastWeekPages: 10,
      streak: { currentStreak: 8, bestStreak: 15 },
      completedSurahs: [],
    };

    const msg = formatWeeklyRecap(data, fr);

    expect(msg).toContain("-- Récap hebdomadaire --");
    expect(msg).toContain("Pages lues : 12 (+20%)");
    expect(msg).toContain("Sessions : 5 (+25%)");
    expect(msg).toContain("Streak : 8 jours consécutifs");
    expect(msg).toContain("Durée : 2h35m");
  });

  it("format correct avec comparaison S-1 negative", () => {
    const data: WeeklyRecapData = {
      thisWeek: { sessions: 3, ayahs: 60, seconds: 5400 },
      lastWeek: { sessions: 5, ayahs: 100, seconds: 7200 },
      thisWeekPages: 8,
      lastWeekPages: 12,
      streak: { currentStreak: 2, bestStreak: 10 },
      completedSurahs: [],
    };

    const msg = formatWeeklyRecap(data, fr);

    expect(msg).toContain("Pages lues : 8 (-33%)");
    expect(msg).toContain("Sessions : 3 (-40%)");
    expect(msg).toContain("Durée : 1h30m (-25%)");
  });

  it("pas de % quand S-1 est vide", () => {
    const data: WeeklyRecapData = {
      thisWeek: { sessions: 3, ayahs: 50, seconds: 1500 },
      lastWeek: { sessions: 0, ayahs: 0, seconds: 0 },
      thisWeekPages: 5,
      lastWeekPages: 0,
      streak: { currentStreak: 3, bestStreak: 3 },
      completedSurahs: [],
    };

    const msg = formatWeeklyRecap(data, fr);

    expect(msg).toContain("Pages lues : 5");
    expect(msg).not.toContain("%");
    expect(msg).toContain("Sessions : 3");
    expect(msg).toContain("Streak : 3 jours consécutifs");
  });

  it("message special quand S courante est vide", () => {
    const data: WeeklyRecapData = {
      thisWeek: { sessions: 0, ayahs: 0, seconds: 0 },
      lastWeek: { sessions: 5, ayahs: 100, seconds: 3000 },
      thisWeekPages: 0,
      lastWeekPages: 10,
      streak: { currentStreak: 0, bestStreak: 5 },
      completedSurahs: [],
    };

    const msg = formatWeeklyRecap(data, fr);

    expect(msg).toBe(
      "-- Récap hebdomadaire --\n\nAucune session cette semaine. C'est le moment de reprendre !"
    );
  });

  it("sourates terminées incluses quand presentes", () => {
    const data: WeeklyRecapData = {
      thisWeek: { sessions: 5, ayahs: 100, seconds: 3000 },
      lastWeek: { sessions: 4, ayahs: 80, seconds: 2500 },
      thisWeekPages: 12,
      lastWeekPages: 10,
      streak: { currentStreak: 8, bestStreak: 15 },
      completedSurahs: [
        { number: 3, nameAr: "آل عمران", name: "Al-Imran", ayahCount: 200 },
      ],
    };

    const msg = formatWeeklyRecap(data, fr);

    expect(msg).toContain("Sourate Al-Imran (3) terminée !");
  });

  it("arrondit les pages fractionnaires", () => {
    const data: WeeklyRecapData = {
      thisWeek: { sessions: 5, ayahs: 100, seconds: 9300 },
      lastWeek: { sessions: 4, ayahs: 80, seconds: 8000 },
      thisWeekPages: 12.7,
      lastWeekPages: 10.3,
      streak: { currentStreak: 8, bestStreak: 15 },
      completedSurahs: [],
    };

    const msg = formatWeeklyRecap(data, fr);

    expect(msg).toContain("Pages lues : 13 (+30%)");
    expect(msg).not.toMatch(/12\.7/);
    expect(msg).not.toMatch(/10\.3/);
  });

  it("pas de ligne sourate quand aucune terminée", () => {
    const data: WeeklyRecapData = {
      thisWeek: { sessions: 5, ayahs: 100, seconds: 3000 },
      lastWeek: { sessions: 4, ayahs: 80, seconds: 2500 },
      thisWeekPages: 12,
      lastWeekPages: 10,
      streak: { currentStreak: 8, bestStreak: 15 },
      completedSurahs: [],
    };

    const msg = formatWeeklyRecap(data, fr);

    expect(msg).not.toContain("Sourate");
    expect(msg).not.toContain("terminée");
  });
});
