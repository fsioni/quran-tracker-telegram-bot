import { fr } from "../src/locales/fr";
import type { Session } from "../src/services/db/types";

const MONTHS_REMAINING_RE =
  /^À ton rythme actuel \(~0\.1 pages\/jour\), il te reste environ \d+ mois$/;

import {
  formatDuration,
  formatError,
  formatEstimation,
  formatHistoryLine,
  formatKahfPageConfirmation,
  formatKahfReminder,
  formatKhatmaMessage,
  formatProgress,
  formatReadConfirmation,
  formatReminder,
  formatSessionConfirmation,
  formatSpeedComparison,
  formatSpeedReport,
  formatStats,
  formatSurahsComplete,
  parseDuration,
  parseImportLine,
  parsePage,
  parseRange,
} from "../src/services/format";

// --- parseDuration ---

describe("parseDuration", () => {
  it("parses minutes and seconds: 8m53 -> 533s", () => {
    const result = parseDuration("8m53", fr);
    expect(result).toEqual({ ok: true, value: 533 });
  });

  it("parses minutes only: 8m -> 480s", () => {
    const result = parseDuration("8m", fr);
    expect(result).toEqual({ ok: true, value: 480 });
  });

  it("parses hours and minutes: 1h30m -> 5400s", () => {
    const result = parseDuration("1h30m", fr);
    expect(result).toEqual({ ok: true, value: 5400 });
  });

  it("parses hours, minutes, and seconds: 1h8m53 -> 4133s", () => {
    const result = parseDuration("1h8m53", fr);
    expect(result).toEqual({ ok: true, value: 4133 });
  });

  it("parses zero: 0m -> 0s", () => {
    const result = parseDuration("0m", fr);
    expect(result).toEqual({ ok: true, value: 0 });
  });

  it("rejects 8min", () => {
    const result = parseDuration("8min", fr);
    expect(result.ok).toBe(false);
  });

  it("rejects bare number 53", () => {
    const result = parseDuration("53", fr);
    expect(result.ok).toBe(false);
  });

  it("rejects abc", () => {
    const result = parseDuration("abc", fr);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("format de durée invalide");
    }
  });
});

// --- parseRange ---

describe("parseRange", () => {
  it("parses same-surah range: 2:77-83", () => {
    const result = parseRange("2:77-83", fr);
    expect(result).toEqual({
      ok: true,
      value: { surahStart: 2, ayahStart: 77, surahEnd: 2, ayahEnd: 83 },
    });
  });

  it("parses cross-surah range: 2:280-3:10", () => {
    const result = parseRange("2:280-3:10", fr);
    expect(result).toEqual({
      ok: true,
      value: { surahStart: 2, ayahStart: 280, surahEnd: 3, ayahEnd: 10 },
    });
  });

  it("parses last surah range: 114:1-6", () => {
    const result = parseRange("114:1-6", fr);
    expect(result).toEqual({
      ok: true,
      value: { surahStart: 114, ayahStart: 1, surahEnd: 114, ayahEnd: 6 },
    });
  });

  it("rejects invalid format: abc", () => {
    const result = parseRange("abc", fr);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("format de plage invalide");
    }
  });

  it("rejects format missing colon: 2-83", () => {
    const result = parseRange("2-83", fr);
    expect(result.ok).toBe(false);
  });
});

// --- parseImportLine ---

describe("parseImportLine", () => {
  // Use a fixed referenceDate for deterministic tests
  const march13 = new Date(2026, 2, 13); // March 13, 2026

  it("parses a complete import line", () => {
    const result = parseImportLine(
      "10/03, 13h30 - 8m53 - 2:77-83",
      fr,
      2026,
      march13
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.date).toBe("2026-03-10");
      expect(result.value.time).toBe("13:30");
      expect(result.value.duration).toBe(533);
      expect(result.value.range).toEqual({
        surahStart: 2,
        ayahStart: 77,
        surahEnd: 2,
        ayahEnd: 83,
      });
    }
  });

  it("deduces previous year when date is in the future", () => {
    // December date when reference year is 2026 and referenceDate is March
    // 15/12 is in the future relative to March, so it should use 2025
    const result = parseImportLine(
      "15/12, 8h00 - 5m - 1:1-7",
      fr,
      2026,
      march13
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.date).toBe("2025-12-15");
    }
  });

  it("parses a complete import line with HH:MM format", () => {
    const result = parseImportLine(
      "10/03, 13:30 - 8m53 - 2:77-83",
      fr,
      2026,
      march13
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.date).toBe("2026-03-10");
      expect(result.value.time).toBe("13:30");
      expect(result.value.duration).toBe(533);
      expect(result.value.range).toEqual({
        surahStart: 2,
        ayahStart: 77,
        surahEnd: 2,
        ayahEnd: 83,
      });
    }
  });

  it("rejects invalid line format", () => {
    const result = parseImportLine("invalid line", fr);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid month (13)", () => {
    const result = parseImportLine(
      "15/13, 8h00 - 5m - 1:1-7",
      fr,
      2026,
      march13
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("mois invalide");
    }
  });

  it("rejects invalid day (32) for March", () => {
    const result = parseImportLine(
      "32/03, 8h00 - 5m - 1:1-7",
      fr,
      2026,
      march13
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("jour invalide");
    }
  });

  it("rejects Feb 30", () => {
    const result = parseImportLine(
      "30/02, 8h00 - 5m - 1:1-7",
      fr,
      2026,
      march13
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("jour invalide");
    }
  });
});

// --- formatDuration ---

describe("formatDuration", () => {
  it("formats 533 seconds as 8m53", () => {
    expect(formatDuration(533)).toBe("8m53");
  });

  it("formats 480 seconds as 8m", () => {
    expect(formatDuration(480)).toBe("8m");
  });

  it("formats 5400 seconds as 1h30m", () => {
    expect(formatDuration(5400)).toBe("1h30m");
  });

  it("formats 0 seconds as 0m", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});

// --- formatSessionConfirmation ---

describe("formatSessionConfirmation", () => {
  it("formats same-surah session with versets/h", () => {
    const result = formatSessionConfirmation(
      {
        surahStart: 2,
        ayahStart: 77,
        surahEnd: 2,
        ayahEnd: 83,
        ayahCount: 7,
        durationSeconds: 533,
      },
      fr
    );
    expect(result).toBe(
      "Session enregistrée : sourate Al-Baqara v.77 à v.83 -- 7 versets en 8m53 (47 versets/h)"
    );
  });

  it("formats cross-surah session with versets/h", () => {
    const result = formatSessionConfirmation(
      {
        surahStart: 2,
        ayahStart: 280,
        surahEnd: 3,
        ayahEnd: 10,
        ayahCount: 17,
        durationSeconds: 533,
      },
      fr
    );
    expect(result).toBe(
      "Session enregistrée : sourate Al-Baqara v.280 à sourate Al-Imran v.10 -- 17 versets en 8m53 (115 versets/h)"
    );
  });

  it("formats session with pages/h when pageStart and pageEnd provided", () => {
    const result = formatSessionConfirmation(
      {
        surahStart: 2,
        ayahStart: 77,
        surahEnd: 2,
        ayahEnd: 83,
        ayahCount: 7,
        durationSeconds: 300,
        type: "extra",
        pageStart: 300,
        pageEnd: 300,
      },
      fr
    );
    expect(result).toBe(
      "Session extra enregistrée : sourate Al-Baqara v.77 à v.83 -- 7 versets en 5m (12.0 pages/h)"
    );
  });

  it("does not show speed when durationSeconds is 0", () => {
    const result = formatSessionConfirmation(
      {
        surahStart: 2,
        ayahStart: 77,
        surahEnd: 2,
        ayahEnd: 83,
        ayahCount: 7,
        durationSeconds: 0,
      },
      fr
    );
    expect(result).toBe(
      "Session enregistrée : sourate Al-Baqara v.77 à v.83 -- 7 versets en 0m"
    );
  });
});

// --- formatHistoryLine ---

describe("formatHistoryLine", () => {
  it("formats same-surah history line (DB format)", () => {
    const result = formatHistoryLine(
      {
        id: 42,
        startedAt: "2026-03-10 13:30:00",
        durationSeconds: 533,
        surahStart: 2,
        ayahStart: 77,
        surahEnd: 2,
        ayahEnd: 83,
        ayahCount: 7,
      },
      fr
    );
    // 7 ayahs / (533/3600) h = 47 v/h
    expect(result).toBe(
      "[N] #42 | 10/03 13h30 | 8m53 | Al-Baqara 2:77-83 (7v, 47v/h)"
    );
  });

  it("formats cross-surah history line (DB format)", () => {
    const result = formatHistoryLine(
      {
        id: 42,
        startedAt: "2026-03-10 13:30:00",
        durationSeconds: 533,
        surahStart: 2,
        ayahStart: 280,
        surahEnd: 3,
        ayahEnd: 10,
        ayahCount: 17,
      },
      fr
    );
    expect(result).toBe(
      "[N] #42 | 10/03 13h30 | 8m53 | Al-Baqara 2:280 - Al-Imran 3:10 (17v, 115v/h)"
    );
  });

  it("also works with ISO format", () => {
    const result = formatHistoryLine(
      {
        id: 1,
        startedAt: "2026-03-10T13:30:00Z",
        durationSeconds: 480,
        surahStart: 1,
        ayahStart: 1,
        surahEnd: 1,
        ayahEnd: 7,
        ayahCount: 7,
      },
      fr
    );
    expect(result).toBe(
      "[N] #1 | 10/03 13h30 | 8m | Al-Fatiha 1:1-7 (7v, 53v/h)"
    );
  });

  it("shows page-based speed when pageStart/pageEnd present", () => {
    const result = formatHistoryLine(
      {
        id: 10,
        startedAt: "2026-03-10 13:30:00",
        durationSeconds: 300,
        surahStart: 2,
        ayahStart: 77,
        surahEnd: 2,
        ayahEnd: 83,
        ayahCount: 7,
        pageStart: 10,
        pageEnd: 10,
      },
      fr
    );
    // 1 page / (300/3600) h = 12.0 p/h
    expect(result).toBe(
      "[N] #10 | 10/03 13h30 | 5m | Al-Baqara 2:77-83 (7v, 1p, 12.0p/h)"
    );
  });

  it("shows page count for multiple pages", () => {
    const result = formatHistoryLine(
      {
        id: 11,
        startedAt: "2026-03-10 13:30:00",
        durationSeconds: 600,
        surahStart: 2,
        ayahStart: 77,
        surahEnd: 2,
        ayahEnd: 83,
        ayahCount: 7,
        pageStart: 10,
        pageEnd: 12,
      },
      fr
    );
    // 3 pages / (600/3600) h = 18.0 p/h
    expect(result).toBe(
      "[N] #11 | 10/03 13h30 | 10m | Al-Baqara 2:77-83 (7v, 3p, 18.0p/h)"
    );
  });

  it("shows no speed when durationSeconds is 0", () => {
    const result = formatHistoryLine(
      {
        id: 5,
        startedAt: "2026-03-10 13:30:00",
        durationSeconds: 0,
        surahStart: 1,
        ayahStart: 1,
        surahEnd: 1,
        ayahEnd: 7,
        ayahCount: 7,
      },
      fr
    );
    expect(result).toBe("[N] #5 | 10/03 13h30 | 0m | Al-Fatiha 1:1-7 (7v)");
  });
});

// --- formatStats ---

describe("formatStats", () => {
  it("formate le message stats complet selon la spec", () => {
    const result = formatStats(
      {
        totalAyahs: 342,
        totalPageSeconds: 15_780,
        totalPages: 20,
        totalSeconds: 15_780, // 4h23m
        currentStreak: 5,
        bestStreak: 12,
        weekAyahs: 45,
        weekPageSeconds: 2280,
        weekPages: 3,
        weekSeconds: 2280, // 38m
        monthAyahs: 187,
        monthPageSeconds: 8100,
        monthPages: 10,
        monthSeconds: 8100, // 2h15m
      },
      fr
    );
    expect(result).toBe(
      [
        "-- Stats globales --",
        "Versets lus : 342",
        "Durée totale : 4h23m",
        "Vitesse moyenne : 4.6 pages/h",
        "Streak actuel : 5 jours",
        "Meilleur streak : 12 jours",
        "",
        "-- Cette semaine --",
        "Versets : 45 | Durée : 38m | Vitesse : 4.7 pages/h",
        "",
        "-- Ce mois --",
        "Versets : 187 | Durée : 2h15m | Vitesse : 4.4 pages/h",
      ].join("\n")
    );
  });

  it("gere 0 sessions (pas de division par zero)", () => {
    const result = formatStats(
      {
        totalAyahs: 0,
        totalPageSeconds: 0,
        totalPages: 0,
        totalSeconds: 0,
        currentStreak: 0,
        bestStreak: 0,
        weekAyahs: 0,
        weekPageSeconds: 0,
        weekPages: 0,
        weekSeconds: 0,
        monthAyahs: 0,
        monthPageSeconds: 0,
        monthPages: 0,
        monthSeconds: 0,
      },
      fr
    );
    expect(result).toContain("Versets lus : 0");
    expect(result).toContain("Vitesse moyenne : 0.0 pages/h");
    expect(result).not.toContain("Vitesse : 0.0 pages/h");
  });

  it("affiche la vitesse par periode", () => {
    const result = formatStats(
      {
        totalAyahs: 342,
        totalPageSeconds: 15_780,
        totalPages: 20,
        totalSeconds: 15_780,
        currentStreak: 5,
        bestStreak: 12,
        weekAyahs: 120,
        weekPageSeconds: 2700,
        weekPages: 5,
        weekSeconds: 2700, // 45m -> 5/2700*3600 = 6.7
        monthAyahs: 340,
        monthPageSeconds: 8100,
        monthPages: 10,
        monthSeconds: 8100, // 2h15m -> 10/8100*3600 = 4.4
      },
      fr
    );
    expect(result).toContain(
      "Versets : 120 | Durée : 45m | Vitesse : 6.7 pages/h"
    );
    expect(result).toContain(
      "Versets : 340 | Durée : 2h15m | Vitesse : 4.4 pages/h"
    );
  });

  it("n'affiche pas la vitesse quand seconds est 0", () => {
    const result = formatStats(
      {
        totalAyahs: 342,
        totalPageSeconds: 15_780,
        totalPages: 20,
        totalSeconds: 15_780,
        currentStreak: 5,
        bestStreak: 12,
        weekAyahs: 0,
        weekPageSeconds: 0,
        weekPages: 0,
        weekSeconds: 0,
        monthAyahs: 0,
        monthPageSeconds: 0,
        monthPages: 0,
        monthSeconds: 0,
      },
      fr
    );
    expect(result).toContain("Versets : 0 | Durée : 0m");
    expect(result).not.toContain("Vitesse : 0.0 pages/h");
  });

  it("affiche la tendance positive vs semaine dernière", () => {
    const result = formatStats(
      {
        totalAyahs: 342,
        totalPageSeconds: 15_780,
        totalPages: 20,
        totalSeconds: 15_780,
        currentStreak: 5,
        bestStreak: 12,
        weekAyahs: 120,
        weekPageSeconds: 2700,
        weekPages: 6,
        weekSeconds: 2700, // 8.0 p/h
        monthAyahs: 340,
        monthPageSeconds: 8100,
        monthPages: 10,
        monthSeconds: 8100,
        prevWeekPageSeconds: 2520,
        prevWeekPages: 5,
        prevWeekSeconds: 2520, // ~7.1 p/h -> +12%
      },
      fr
    );
    expect(result).toContain("+12% vs semaine dernière");
  });

  it("affiche la tendance negative vs semaine dernière", () => {
    const result = formatStats(
      {
        totalAyahs: 342,
        totalPageSeconds: 15_780,
        totalPages: 20,
        totalSeconds: 15_780,
        currentStreak: 5,
        bestStreak: 12,
        weekAyahs: 100,
        weekPageSeconds: 2520,
        weekPages: 5,
        weekSeconds: 2520, // ~7.1 p/h
        monthAyahs: 340,
        monthPageSeconds: 8100,
        monthPages: 10,
        monthSeconds: 8100,
        prevWeekPageSeconds: 2700,
        prevWeekPages: 6,
        prevWeekSeconds: 2700, // 8.0 p/h -> -11%
      },
      fr
    );
    expect(result).toContain("-11% vs semaine dernière");
  });

  it("n'affiche pas la tendance si pas de donnees semaine precedente", () => {
    const result = formatStats(
      {
        totalAyahs: 342,
        totalPageSeconds: 15_780,
        totalPages: 20,
        totalSeconds: 15_780,
        currentStreak: 5,
        bestStreak: 12,
        weekAyahs: 120,
        weekPageSeconds: 2700,
        weekPages: 5,
        weekSeconds: 2700,
        monthAyahs: 340,
        monthPageSeconds: 8100,
        monthPages: 10,
        monthSeconds: 8100,
      },
      fr
    );
    expect(result).not.toContain("vs semaine dernière");
  });

  it("n'affiche pas la tendance si prevWeekSeconds est 0", () => {
    const result = formatStats(
      {
        totalAyahs: 342,
        totalPageSeconds: 15_780,
        totalPages: 20,
        totalSeconds: 15_780,
        currentStreak: 5,
        bestStreak: 12,
        weekAyahs: 120,
        weekPageSeconds: 2700,
        weekPages: 5,
        weekSeconds: 2700,
        monthAyahs: 340,
        monthPageSeconds: 8100,
        monthPages: 10,
        monthSeconds: 8100,
        prevWeekPageSeconds: 0,
        prevWeekPages: 0,
        prevWeekSeconds: 0,
      },
      fr
    );
    expect(result).not.toContain("vs semaine dernière");
  });
});

// --- formatProgress ---

describe("formatProgress", () => {
  it("formate la progression avec barre et prochaine page", () => {
    const result = formatProgress(
      {
        totalAyahsRead: 342,
        totalAyahs: 6236,
        nextPage: 11,
      },
      fr
    );
    // 342/6236 = 5.5%, filled = round(1.1) = 1
    expect(result).toBe(
      [
        "Progression : 342 / 6236 versets (5.5%)",
        "[#-------------------] 5.5%",
        "Prochaine page : 11",
      ].join("\n")
    );
  });

  it("formate 0% de progression", () => {
    const result = formatProgress(
      {
        totalAyahsRead: 0,
        totalAyahs: 6236,
        nextPage: null,
      },
      fr
    );
    expect(result).toContain("0 / 6236 versets (0.0%)");
    expect(result).toContain("[--------------------]");
    expect(result).not.toContain("Prochaine page");
  });

  it("formate ~40% de progression", () => {
    const result = formatProgress(
      {
        totalAyahsRead: 2494,
        totalAyahs: 6236,
        nextPage: 12,
      },
      fr
    );
    expect(result).toContain("2494 / 6236 versets (40.0%)");
    expect(result).toContain("[########------------] 40.0%");
    expect(result).toContain("Prochaine page : 12");
  });
});

// --- formatReminder ---

describe("formatReminder", () => {
  it("formats reminder with next page and streak", () => {
    const result = formatReminder(
      {
        nextPage: 42,
        weekSessions: 5,
        weekAyahs: 120,
        streak: 3,
      },
      fr
    );
    expect(result).toBe(
      [
        "Rappel lecture du Coran",
        "",
        "Prochaine page : 42",
        "Cette semaine : 5 sessions, 120 versets",
        "Série : 3 jours consécutifs",
        "",
        "Continue comme ça !",
      ].join("\n")
    );
  });

  it("formats reminder without streak", () => {
    const result = formatReminder(
      {
        nextPage: 1,
        weekSessions: 0,
        weekAyahs: 0,
        streak: 0,
      },
      fr
    );
    expect(result).toContain("Prochaine page : 1");
    expect(result).toContain("C'est le moment de reprendre !");
  });
});

// --- parsePage ---

describe("parsePage", () => {
  it("parses single page: 300", () => {
    const result = parsePage("300", fr);
    expect(result).toEqual({
      ok: true,
      value: { pageStart: 300, pageEnd: 300 },
    });
  });

  it("parses page range: 300-304", () => {
    const result = parsePage("300-304", fr);
    expect(result).toEqual({
      ok: true,
      value: { pageStart: 300, pageEnd: 304 },
    });
  });

  it("rejects page 0", () => {
    const result = parsePage("0", fr);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("page invalide");
    }
  });

  it("rejects page 605", () => {
    const result = parsePage("605", fr);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("page invalide");
    }
  });

  it("rejects abc", () => {
    const result = parsePage("abc", fr);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("format de page invalide");
    }
  });

  it("rejects range with end out of bounds: 300-605", () => {
    const result = parsePage("300-605", fr);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("page invalide");
    }
  });
});

// --- formatReadConfirmation ---

describe("formatReadConfirmation", () => {
  it("formats single page read with speed", () => {
    const result = formatReadConfirmation(
      {
        pageStart: 42,
        pageEnd: 42,
        durationSeconds: 360,
        totalPagesRead: 42,
        totalPages: 604,
      },
      fr
    );
    expect(result).toBe(
      "Page 42 lue en 6m -- 10.0 pages/h (42/604)\nProchaine page : 43"
    );
  });

  it("formats multi-page read with speed", () => {
    const result = formatReadConfirmation(
      {
        pageStart: 42,
        pageEnd: 44,
        durationSeconds: 900,
        totalPagesRead: 44,
        totalPages: 604,
      },
      fr
    );
    expect(result).toBe(
      "Pages 42-44 lues en 15m -- 12.0 pages/h (44/604)\nProchaine page : 45"
    );
  });

  it("formats last page (604)", () => {
    const result = formatReadConfirmation(
      {
        pageStart: 604,
        pageEnd: 604,
        durationSeconds: 300,
        totalPagesRead: 604,
        totalPages: 604,
      },
      fr
    );
    expect(result).toBe(
      "Page 604 lue en 5m -- 12.0 pages/h (604/604)\nCoran terminé ! Alhamdulillah !"
    );
  });

  it("does not show speed when durationSeconds is 0", () => {
    const result = formatReadConfirmation(
      {
        pageStart: 42,
        pageEnd: 42,
        durationSeconds: 0,
        totalPagesRead: 42,
        totalPages: 604,
      },
      fr
    );
    expect(result).toBe("Page 42 lue en 0m (42/604)\nProchaine page : 43");
  });
});

// --- formatKahfPageConfirmation ---

describe("formatKahfPageConfirmation", () => {
  it("formats in progress (3/12) with speed", () => {
    const result = formatKahfPageConfirmation(
      {
        kahfPage: 3,
        kahfTotal: 12,
        durationSeconds: 300,
        weekPagesRead: 3,
        weekTotalSeconds: 840,
        isComplete: false,
      },
      fr
    );
    expect(result).toBe(
      "Al-Kahf page 3/12 lue en 5m -- 12.0 pages/h\nCette semaine : 3/12 pages, 14m au total"
    );
  });

  it("formats multi-page kahf session with correct speed", () => {
    // 3 pages in 15m = 3 / (900/3600) = 12.0 pages/h
    const result = formatKahfPageConfirmation(
      {
        kahfPage: 6,
        kahfTotal: 12,
        durationSeconds: 900,
        weekPagesRead: 6,
        weekTotalSeconds: 1800,
        isComplete: false,
        sessionPages: 3,
      },
      fr
    );
    expect(result).toBe(
      "Al-Kahf page 6/12 lue en 15m -- 12.0 pages/h\nCette semaine : 6/12 pages, 30m au total"
    );
  });

  it("does not show speed when durationSeconds is 0", () => {
    const result = formatKahfPageConfirmation(
      {
        kahfPage: 3,
        kahfTotal: 12,
        durationSeconds: 0,
        weekPagesRead: 3,
        weekTotalSeconds: 840,
        isComplete: false,
      },
      fr
    );
    expect(result).toBe(
      "Al-Kahf page 3/12 lue en 0m\nCette semaine : 3/12 pages, 14m au total"
    );
  });

  it("formats completion (12/12) without comparisons", () => {
    const result = formatKahfPageConfirmation(
      {
        kahfPage: 12,
        kahfTotal: 12,
        durationSeconds: 300,
        weekPagesRead: 12,
        weekTotalSeconds: 3120,
        isComplete: true,
      },
      fr
    );
    expect(result).toBe("Al-Kahf terminée ! 12/12 pages en 52m");
  });

  it("formats completion with last week comparison (faster)", () => {
    const result = formatKahfPageConfirmation(
      {
        kahfPage: 12,
        kahfTotal: 12,
        durationSeconds: 300,
        weekPagesRead: 12,
        weekTotalSeconds: 3120,
        isComplete: true,
        lastWeekTotalSeconds: 3480,
      },
      fr
    );
    expect(result).toBe(
      "Al-Kahf terminée ! 12/12 pages en 52m\nSemaine dernière : 58m (-6m, bravo !)"
    );
  });

  it("formats completion with last week comparison (slower)", () => {
    const result = formatKahfPageConfirmation(
      {
        kahfPage: 12,
        kahfTotal: 12,
        durationSeconds: 300,
        weekPagesRead: 12,
        weekTotalSeconds: 3480,
        isComplete: true,
        lastWeekTotalSeconds: 3300,
      },
      fr
    );
    expect(result).toBe(
      "Al-Kahf terminée ! 12/12 pages en 58m\nSemaine dernière : 55m (+3m)"
    );
  });

  it("formats completion with same time as last week", () => {
    const result = formatKahfPageConfirmation(
      {
        kahfPage: 12,
        kahfTotal: 12,
        durationSeconds: 300,
        weekPagesRead: 12,
        weekTotalSeconds: 3120,
        isComplete: true,
        lastWeekTotalSeconds: 3120,
      },
      fr
    );
    expect(result).toBe(
      "Al-Kahf terminée ! 12/12 pages en 52m\nSemaine dernière : 52m"
    );
  });
});

// --- formatKahfReminder ---

describe("formatKahfReminder", () => {
  it("formats with history", () => {
    const result = formatKahfReminder(
      {
        lastDate: "2026-03-07 14:00:00",
        lastDuration: 1500,
      },
      fr
    );
    expect(result).toBe(
      "Rappel : c'est vendredi ! Pense à lire sourate Al-Kahf.\n\nDernière lecture : 07/03 en 25m"
    );
  });

  it("formats without history", () => {
    const result = formatKahfReminder({}, fr);
    expect(result).toBe(
      "Rappel : c'est vendredi ! Pense à lire sourate Al-Kahf."
    );
  });

  it("formats with next kahf page", () => {
    const result = formatKahfReminder(
      {
        nextKahfPage: 296,
      },
      fr
    );
    expect(result).toBe(
      "Rappel : c'est vendredi ! Pense à lire sourate Al-Kahf.\nProchaine page : 296"
    );
  });

  it("formats with history and next kahf page", () => {
    const result = formatKahfReminder(
      {
        lastDate: "2026-03-07 14:00:00",
        lastDuration: 1500,
        nextKahfPage: 296,
      },
      fr
    );
    expect(result).toBe(
      "Rappel : c'est vendredi ! Pense à lire sourate Al-Kahf.\n\nDernière lecture : 07/03 en 25m\nProchaine page : 296"
    );
  });
});

// --- formatHistoryLine with tags ---

describe("formatHistoryLine with type tags", () => {
  const baseSession = {
    id: 42,
    startedAt: "2026-03-10 13:30:00",
    durationSeconds: 533,
    surahStart: 2,
    ayahStart: 77,
    surahEnd: 2,
    ayahEnd: 83,
    ayahCount: 7,
  };

  it("formats with [N] tag for normal type", () => {
    const result = formatHistoryLine({ ...baseSession, type: "normal" }, fr);
    expect(result).toBe(
      "[N] #42 | 10/03 13h30 | 8m53 | Al-Baqara 2:77-83 (7v, 47v/h)"
    );
  });

  it("formats with [E] tag for extra type", () => {
    const result = formatHistoryLine({ ...baseSession, type: "extra" }, fr);
    expect(result).toBe(
      "[E] #42 | 10/03 13h30 | 8m53 | Al-Baqara 2:77-83 (7v, 47v/h)"
    );
  });

  it("formats with [K] tag for kahf type", () => {
    const result = formatHistoryLine({ ...baseSession, type: "kahf" }, fr);
    expect(result).toBe(
      "[K] #42 | 10/03 13h30 | 8m53 | Al-Baqara 2:77-83 (7v, 47v/h)"
    );
  });
});

// --- formatHistoryLine with Kahf partial page ---

describe("formatHistoryLine with Kahf partial page", () => {
  it("adjusts page count and speed for kahf session starting at page 293", () => {
    const result = formatHistoryLine(
      {
        id: 99,
        startedAt: "2026-03-10 13:30:00",
        durationSeconds: 3600,
        surahStart: 18,
        ayahStart: 1,
        surahEnd: 18,
        ayahEnd: 110,
        ayahCount: 110,
        type: "kahf",
        pageStart: 293,
        pageEnd: 295,
      },
      fr
    );
    // 3 raw pages -> 2 + 4/15 ≈ 2.267 effective (293 weighted 4/15)
    // 2.267 pages / 1h ≈ 2.3 p/h
    expect(result).toBe(
      "[K] #99 | 10/03 13h30 | 1h0m | Al-Kahf 18:1-110 (110v, 2.3p, 2.3p/h)"
    );
  });

  it("does not adjust for kahf session not starting at page 293", () => {
    const result = formatHistoryLine(
      {
        id: 100,
        startedAt: "2026-03-10 13:30:00",
        durationSeconds: 3600,
        surahStart: 18,
        ayahStart: 10,
        surahEnd: 18,
        ayahEnd: 50,
        ayahCount: 41,
        type: "kahf",
        pageStart: 294,
        pageEnd: 296,
      },
      fr
    );
    // 3 raw pages, no adjustment
    // 3 pages / 1h = 3.0 p/h
    expect(result).toBe(
      "[K] #100 | 10/03 13h30 | 1h0m | Al-Kahf 18:10-50 (41v, 3p, 3.0p/h)"
    );
  });
});

// --- formatSessionConfirmation with type ---

describe("formatSessionConfirmation with type", () => {
  it("formats extra session", () => {
    const result = formatSessionConfirmation(
      {
        surahStart: 2,
        ayahStart: 77,
        surahEnd: 2,
        ayahEnd: 83,
        ayahCount: 7,
        durationSeconds: 533,
        type: "extra",
      },
      fr
    );
    expect(result).toBe(
      "Session extra enregistrée : sourate Al-Baqara v.77 à v.83 -- 7 versets en 8m53 (47 versets/h)"
    );
  });
});

// --- formatEstimation ---

describe("formatEstimation", () => {
  const today = "2026-03-15";

  it("formate une date de fin avec un rythme normal", () => {
    // 1.2 pages/jour, 400 pages restantes -> ceil(333.3) = 334 jours -> 2027-02-12
    const result = formatEstimation(1.2, 400, today, fr);
    expect(result).toBe(
      "À ce rythme (~1.2 pages/jour), tu finiras vers le 12 février 2027"
    );
  });

  it("retourne message 'pas assez de donnees' quand pace est 0", () => {
    const result = formatEstimation(0, 400, today, fr);
    expect(result).toBe(
      "Pas assez de données récentes pour estimer (lis régulièrement pour voir une projection)"
    );
  });

  it("retourne format en mois quand estimation > 5 ans", () => {
    // 0.1 pages/jour, 500 pages = 5000 jours > 5*365
    const result = formatEstimation(0.1, 500, today, fr);
    expect(result).toMatch(MONTHS_REMAINING_RE);
  });

  it("retourne message pour pace negatif", () => {
    const result = formatEstimation(-1, 400, today, fr);
    expect(result).toBe(
      "Pas assez de données récentes pour estimer (lis régulièrement pour voir une projection)"
    );
  });
});

// --- formatError ---

describe("formatError", () => {
  it("formats error with example", () => {
    expect(formatError("description ici", fr, "2:77-83")).toBe(
      "Erreur : description ici\nExemple : 2:77-83"
    );
  });

  it("formats error without example", () => {
    expect(formatError("description ici", fr)).toBe("Erreur : description ici");
  });
});

// --- formatKhatmaMessage ---

describe("formatKhatmaMessage", () => {
  it("formats first khatma", () => {
    expect(formatKhatmaMessage(1, fr)).toBe(
      "Khatma ! Tu as terminé ta première lecture complète du Coran. Alhamdulillah !"
    );
  });

  it("formats second khatma", () => {
    expect(formatKhatmaMessage(2, fr)).toBe(
      "Khatma ! Tu as terminé ta 2e lecture complète du Coran. Alhamdulillah !"
    );
  });
});

// --- formatSurahsComplete ---

describe("formatSurahsComplete", () => {
  it("formats single surah", () => {
    expect(formatSurahsComplete([{ number: 2, name: "Al-Baqara" }], fr)).toBe(
      "Sourate Al-Baqara (2) terminée !"
    );
  });

  it("formats multiple surahs", () => {
    expect(
      formatSurahsComplete(
        [
          { number: 112, name: "Al-Ikhlas" },
          { number: 113, name: "Al-Falaq" },
          { number: 114, name: "An-Nas" },
        ],
        fr
      )
    ).toBe(
      "Sourates terminées : Al-Ikhlas (112), Al-Falaq (113), An-Nas (114)"
    );
  });
});

// --- formatProgress with khatmaCount ---

describe("formatProgress with khatmaCount", () => {
  it("affiche le nombre de khatmas quand > 0", () => {
    const result = formatProgress(
      {
        totalAyahsRead: 342,
        totalAyahs: 6236,
        nextPage: 5,
        khatmaCount: 2,
      },
      fr
    );
    expect(result).toContain("Khatmas : 2");
  });

  it("n'affiche pas la ligne khatmas quand 0", () => {
    const result = formatProgress(
      {
        totalAyahsRead: 342,
        totalAyahs: 6236,
        nextPage: 5,
        khatmaCount: 0,
      },
      fr
    );
    expect(result).not.toContain("Khatmas");
  });

  it("n'affiche pas la ligne khatmas quand non fourni", () => {
    const result = formatProgress(
      {
        totalAyahsRead: 342,
        totalAyahs: 6236,
        nextPage: 5,
      },
      fr
    );
    expect(result).not.toContain("Khatmas");
  });
});

// --- formatSpeedReport ---

describe("formatSpeedReport", () => {
  const makeSession = (overrides: Partial<Session> = {}): Session => ({
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
    ...overrides,
  });

  it("formate le rapport complet avec les 3 types", () => {
    const result = formatSpeedReport(
      {
        averages: { global: 15.5, last7Days: 16.2, last30Days: 14.8 },
        bestSession: makeSession({
          id: 42,
          ayahCount: 50,
          durationSeconds: 800,
          pageStart: 1,
          pageEnd: 5,
        }),
        longestSession: makeSession({
          id: 38,
          startedAt: "2026-03-08 10:00:00",
          durationSeconds: 4320,
        }),
        byType: [
          { type: "normal", avgSpeed: 15.2, sessionCount: 45 },
          { type: "extra", avgSpeed: 17.1, sessionCount: 12 },
          { type: "kahf", avgSpeed: 8.5, sessionCount: 8 },
        ],
      },
      fr
    );

    expect(result).toBe(
      [
        "-- Vitesse de lecture --",
        "",
        "Moyenne globale : 15.5 pages/h",
        "Moyenne 7 derniers jours : 16.2 pages/h",
        "Moyenne 30 derniers jours : 14.8 pages/h",
        "",
        "Meilleure session : #42 (22.5 pages/h) - 10/03",
        "Plus longue session : #38 (1h12m) - 08/03",
        "",
        "Par type :",
        "  Normal : 15.2 pages/h (45 sessions)",
        "  Extra  : 17.1 pages/h (12 sessions)",
        "  Kahf   : 8.5 pages/h (8 sessions)",
      ].join("\n")
    );
  });

  it("formate avec seulement 1 type", () => {
    const result = formatSpeedReport(
      {
        averages: { global: 12, last7Days: null, last30Days: 12 },
        bestSession: null,
        longestSession: null,
        byType: [{ type: "normal", avgSpeed: 12, sessionCount: 5 }],
      },
      fr
    );

    expect(result).toContain("Moyenne globale : 12.0 pages/h");
    expect(result).not.toContain("Moyenne 7 derniers jours");
    expect(result).toContain("Moyenne 30 derniers jours : 12.0 pages/h");
    expect(result).not.toContain("Meilleure session");
    expect(result).not.toContain("Plus longue session");
    expect(result).toContain("Normal : 12.0 pages/h (5 sessions)");
  });

  it("formate sans records (bestSession/longestSession null)", () => {
    const result = formatSpeedReport(
      {
        averages: { global: 10, last7Days: 10, last30Days: 10 },
        bestSession: null,
        longestSession: null,
        byType: [{ type: "normal", avgSpeed: 10, sessionCount: 3 }],
      },
      fr
    );

    expect(result).not.toContain("Meilleure session");
    expect(result).not.toContain("Plus longue session");
    expect(result).toContain("Par type :");
  });

  it("formate les dates en DD/MM", () => {
    const result = formatSpeedReport(
      {
        averages: { global: 10, last7Days: null, last30Days: null },
        bestSession: makeSession({
          startedAt: "2026-01-05 09:00:00",
          ayahCount: 30,
          durationSeconds: 600,
          pageStart: 20,
          pageEnd: 25,
        }),
        longestSession: makeSession({
          id: 10,
          startedAt: "2026-12-25 14:00:00",
          durationSeconds: 7200,
        }),
        byType: [],
      },
      fr
    );

    expect(result).toContain("05/01");
    expect(result).toContain("25/12");
  });

  it("aligne les labels des types avec padding", () => {
    const result = formatSpeedReport(
      {
        averages: { global: 10, last7Days: null, last30Days: null },
        bestSession: null,
        longestSession: null,
        byType: [
          { type: "normal", avgSpeed: 10, sessionCount: 10 },
          { type: "extra", avgSpeed: 12, sessionCount: 5 },
          { type: "kahf", avgSpeed: 8, sessionCount: 3 },
        ],
      },
      fr
    );

    // "Normal" (6 chars) is the longest, so "Extra" and "Kahf" should be padded
    expect(result).toContain("  Normal : 10.0 pages/h (10 sessions)");
    expect(result).toContain("  Extra  : 12.0 pages/h (5 sessions)");
    expect(result).toContain("  Kahf   : 8.0 pages/h (3 sessions)");
  });
});

// --- formatSpeedComparison ---

describe("formatSpeedComparison", () => {
  it("returns positive percentage with + prefix", () => {
    expect(formatSpeedComparison(12.5, 10, fr)).toBe("+25% vs votre moy. 7j");
  });

  it("returns negative percentage", () => {
    expect(formatSpeedComparison(9.2, 10, fr)).toBe("-8% vs votre moy. 7j");
  });

  it("returns +0% when speeds are equal", () => {
    expect(formatSpeedComparison(10, 10, fr)).toBe("+0% vs votre moy. 7j");
  });

  it("returns empty string when avgSpeed is null", () => {
    expect(formatSpeedComparison(10, null, fr)).toBe("");
  });

  it("returns empty string when avgSpeed is 0", () => {
    expect(formatSpeedComparison(10, 0, fr)).toBe("");
  });
});
