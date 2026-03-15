import {
  parseDuration,
  parseRange,
  parseImportLine,
  parsePage,
  formatDuration,
  formatSessionConfirmation,
  formatHistoryLine,
  formatStats,
  formatProgress,
  formatReminder,
  formatReadConfirmation,
  formatKahfPageConfirmation,
  formatKahfReminder,
  formatEstimation,
  formatError,
} from "../src/services/format";

// --- parseDuration ---

describe("parseDuration", () => {
  it("parses minutes and seconds: 8m53 -> 533s", () => {
    const result = parseDuration("8m53");
    expect(result).toEqual({ ok: true, value: 533 });
  });

  it("parses minutes only: 8m -> 480s", () => {
    const result = parseDuration("8m");
    expect(result).toEqual({ ok: true, value: 480 });
  });

  it("parses hours and minutes: 1h30m -> 5400s", () => {
    const result = parseDuration("1h30m");
    expect(result).toEqual({ ok: true, value: 5400 });
  });

  it("parses hours, minutes, and seconds: 1h8m53 -> 4133s", () => {
    const result = parseDuration("1h8m53");
    expect(result).toEqual({ ok: true, value: 4133 });
  });

  it("parses zero: 0m -> 0s", () => {
    const result = parseDuration("0m");
    expect(result).toEqual({ ok: true, value: 0 });
  });

  it("rejects 8min", () => {
    const result = parseDuration("8min");
    expect(result.ok).toBe(false);
  });

  it("rejects bare number 53", () => {
    const result = parseDuration("53");
    expect(result.ok).toBe(false);
  });

  it("rejects abc", () => {
    const result = parseDuration("abc");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("format de duree invalide");
    }
  });
});

// --- parseRange ---

describe("parseRange", () => {
  it("parses same-surah range: 2:77-83", () => {
    const result = parseRange("2:77-83");
    expect(result).toEqual({
      ok: true,
      value: { surahStart: 2, ayahStart: 77, surahEnd: 2, ayahEnd: 83 },
    });
  });

  it("parses cross-surah range: 2:280-3:10", () => {
    const result = parseRange("2:280-3:10");
    expect(result).toEqual({
      ok: true,
      value: { surahStart: 2, ayahStart: 280, surahEnd: 3, ayahEnd: 10 },
    });
  });

  it("parses last surah range: 114:1-6", () => {
    const result = parseRange("114:1-6");
    expect(result).toEqual({
      ok: true,
      value: { surahStart: 114, ayahStart: 1, surahEnd: 114, ayahEnd: 6 },
    });
  });

  it("rejects invalid format: abc", () => {
    const result = parseRange("abc");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("format de plage invalide");
    }
  });

  it("rejects format missing colon: 2-83", () => {
    const result = parseRange("2-83");
    expect(result.ok).toBe(false);
  });
});

// --- parseImportLine ---

describe("parseImportLine", () => {
  // Use a fixed referenceDate for deterministic tests
  const march13 = new Date(2026, 2, 13); // March 13, 2026

  it("parses a complete import line", () => {
    const result = parseImportLine("10/03, 13h30 - 8m53 - 2:77-83", 2026, march13);
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
    const result = parseImportLine("15/12, 8h00 - 5m - 1:1-7", 2026, march13);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.date).toBe("2025-12-15");
    }
  });

  it("rejects invalid line format", () => {
    const result = parseImportLine("invalid line");
    expect(result.ok).toBe(false);
  });

  it("rejects invalid month (13)", () => {
    const result = parseImportLine("15/13, 8h00 - 5m - 1:1-7", 2026, march13);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("mois invalide");
    }
  });

  it("rejects invalid day (32) for March", () => {
    const result = parseImportLine("32/03, 8h00 - 5m - 1:1-7", 2026, march13);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("jour invalide");
    }
  });

  it("rejects Feb 30", () => {
    const result = parseImportLine("30/02, 8h00 - 5m - 1:1-7", 2026, march13);
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
  it("formats same-surah session", () => {
    const result = formatSessionConfirmation({
      surahStart: 2,
      ayahStart: 77,
      surahEnd: 2,
      ayahEnd: 83,
      ayahCount: 7,
      durationSeconds: 533,
    });
    expect(result).toBe(
      "Session enregistree : sourate Al-Baqara v.77 a v.83 -- 7 versets en 8m53",
    );
  });

  it("formats cross-surah session", () => {
    const result = formatSessionConfirmation({
      surahStart: 2,
      ayahStart: 280,
      surahEnd: 3,
      ayahEnd: 10,
      ayahCount: 17,
      durationSeconds: 533,
    });
    expect(result).toBe(
      "Session enregistree : sourate Al-Baqara v.280 a sourate Al-Imran v.10 -- 17 versets en 8m53",
    );
  });
});

// --- formatHistoryLine ---

describe("formatHistoryLine", () => {
  it("formats same-surah history line (DB format)", () => {
    const result = formatHistoryLine({
      id: 42,
      startedAt: "2026-03-10 13:30:00",
      durationSeconds: 533,
      surahStart: 2,
      ayahStart: 77,
      surahEnd: 2,
      ayahEnd: 83,
      ayahCount: 7,
    });
    expect(result).toBe(
      "[N] #42 | 10/03 13h30 | 8m53 | Al-Baqara 2:77-83 (7v)",
    );
  });

  it("formats cross-surah history line (DB format)", () => {
    const result = formatHistoryLine({
      id: 42,
      startedAt: "2026-03-10 13:30:00",
      durationSeconds: 533,
      surahStart: 2,
      ayahStart: 280,
      surahEnd: 3,
      ayahEnd: 10,
      ayahCount: 17,
    });
    expect(result).toBe(
      "[N] #42 | 10/03 13h30 | 8m53 | Al-Baqara 2:280 - Al-Imran 3:10 (17v)",
    );
  });

  it("also works with ISO format", () => {
    const result = formatHistoryLine({
      id: 1,
      startedAt: "2026-03-10T13:30:00Z",
      durationSeconds: 480,
      surahStart: 1,
      ayahStart: 1,
      surahEnd: 1,
      ayahEnd: 7,
      ayahCount: 7,
    });
    expect(result).toBe(
      "[N] #1 | 10/03 13h30 | 8m | Al-Fatiha 1:1-7 (7v)",
    );
  });
});

// --- formatStats ---

describe("formatStats", () => {
  it("formate le message stats complet selon la spec", () => {
    const result = formatStats({
      totalAyahs: 342,
      totalSeconds: 15780, // 4h23m
      currentStreak: 5,
      bestStreak: 12,
      weekAyahs: 45,
      weekSeconds: 2280, // 38m
      monthAyahs: 187,
      monthSeconds: 8100, // 2h15m
    });
    expect(result).toBe(
      [
        "-- Stats globales --",
        "Versets lus : 342",
        "Duree totale : 4h23m",
        "Vitesse moyenne : 78 versets/heure",
        "Streak actuel : 5 jours",
        "Meilleur streak : 12 jours",
        "",
        "-- Cette semaine --",
        "Versets : 45 | Duree : 38m",
        "-- Ce mois --",
        "Versets : 187 | Duree : 2h15m",
      ].join("\n"),
    );
  });

  it("gere 0 sessions (pas de division par zero)", () => {
    const result = formatStats({
      totalAyahs: 0,
      totalSeconds: 0,
      currentStreak: 0,
      bestStreak: 0,
      weekAyahs: 0,
      weekSeconds: 0,
      monthAyahs: 0,
      monthSeconds: 0,
    });
    expect(result).toContain("Versets lus : 0");
    expect(result).toContain("Vitesse moyenne : 0 versets/heure");
  });
});

// --- formatProgress ---

describe("formatProgress", () => {
  it("formate la progression avec barre et dernier point", () => {
    const result = formatProgress({
      totalAyahsRead: 342,
      totalAyahs: 6236,
      lastSurah: 3,
      lastAyah: 10,
    });
    // 342/6236 = 5.5%, filled = round(1.1) = 1
    expect(result).toBe(
      [
        "Progression : 342 / 6236 versets (5.5%)",
        "[#-------------------] 5.5%",
        "Dernier point : sourate Al-Imran (3), verset 10",
      ].join("\n"),
    );
  });

  it("formate 0% de progression", () => {
    const result = formatProgress({
      totalAyahsRead: 0,
      totalAyahs: 6236,
      lastSurah: 1,
      lastAyah: 1,
    });
    expect(result).toContain("0 / 6236 versets (0.0%)");
    expect(result).toContain("[--------------------]");
  });

  it("formate ~40% de progression", () => {
    const result = formatProgress({
      totalAyahsRead: 2494,
      totalAyahs: 6236,
      lastSurah: 2,
      lastAyah: 83,
    });
    expect(result).toContain("2494 / 6236 versets (40.0%)");
    expect(result).toContain("[########------------] 40.0%");
    expect(result).toContain("Dernier point : sourate Al-Baqara (2), verset 83");
  });
});

// --- formatReminder ---

describe("formatReminder", () => {
  it("formats reminder with streak (DB format)", () => {
    const result = formatReminder({
      lastSessionDate: "2026-03-10 13:30:00",
      lastSurahNum: 2,
      lastAyah: 83,
      weekSessions: 5,
      weekAyahs: 120,
      streak: 3,
    });
    expect(result).toBe(
      [
        "Rappel lecture du Coran",
        "",
        "Derniere session : 10/03 - sourate Al-Baqara v.83",
        "Cette semaine : 5 sessions, 120 versets",
        "Serie : 3 jours consecutifs",
        "",
        "Continue comme ca !",
      ].join("\n"),
    );
  });

  it("formats reminder without streak", () => {
    const result = formatReminder({
      lastSessionDate: "2026-03-10 13:30:00",
      lastSurahNum: 2,
      lastAyah: 83,
      weekSessions: 0,
      weekAyahs: 0,
      streak: 0,
    });
    expect(result).toContain("C'est le moment de reprendre !");
  });
});

// --- parsePage ---

describe("parsePage", () => {
  it("parses single page: 300", () => {
    const result = parsePage("300");
    expect(result).toEqual({ ok: true, value: { pageStart: 300, pageEnd: 300 } });
  });

  it("parses page range: 300-304", () => {
    const result = parsePage("300-304");
    expect(result).toEqual({ ok: true, value: { pageStart: 300, pageEnd: 304 } });
  });

  it("rejects page 0", () => {
    const result = parsePage("0");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("page invalide");
    }
  });

  it("rejects page 605", () => {
    const result = parsePage("605");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("page invalide");
    }
  });

  it("rejects abc", () => {
    const result = parsePage("abc");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("format de page invalide");
    }
  });

  it("rejects range with end out of bounds: 300-605", () => {
    const result = parsePage("300-605");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("page invalide");
    }
  });
});

// --- formatReadConfirmation ---

describe("formatReadConfirmation", () => {
  it("formats single page read", () => {
    const result = formatReadConfirmation({
      pageStart: 42,
      pageEnd: 42,
      durationSeconds: 300,
      totalPagesRead: 42,
      totalPages: 604,
    });
    expect(result).toBe("Page 42 lue en 5m (42/604)\nProchaine page : 43");
  });

  it("formats multi-page read", () => {
    const result = formatReadConfirmation({
      pageStart: 42,
      pageEnd: 44,
      durationSeconds: 900,
      totalPagesRead: 44,
      totalPages: 604,
    });
    expect(result).toBe("Pages 42-44 lues en 15m (44/604)\nProchaine page : 45");
  });

  it("formats last page (604)", () => {
    const result = formatReadConfirmation({
      pageStart: 604,
      pageEnd: 604,
      durationSeconds: 300,
      totalPagesRead: 604,
      totalPages: 604,
    });
    expect(result).toBe("Page 604 lue en 5m (604/604)\nCoran termine ! Alhamdulillah !");
  });
});

// --- formatKahfPageConfirmation ---

describe("formatKahfPageConfirmation", () => {
  it("formats in progress (3/12)", () => {
    const result = formatKahfPageConfirmation({
      kahfPage: 3,
      kahfTotal: 12,
      durationSeconds: 300,
      weekPagesRead: 3,
      weekTotalSeconds: 840,
      isComplete: false,
    });
    expect(result).toBe("Al-Kahf page 3/12 lue en 5m\nCette semaine : 3/12 pages, 14m au total");
  });

  it("formats completion (12/12) without comparisons", () => {
    const result = formatKahfPageConfirmation({
      kahfPage: 12,
      kahfTotal: 12,
      durationSeconds: 300,
      weekPagesRead: 12,
      weekTotalSeconds: 3120,
      isComplete: true,
    });
    expect(result).toBe("Al-Kahf terminee ! 12/12 pages en 52m");
  });

  it("formats completion with last week comparison (faster)", () => {
    const result = formatKahfPageConfirmation({
      kahfPage: 12,
      kahfTotal: 12,
      durationSeconds: 300,
      weekPagesRead: 12,
      weekTotalSeconds: 3120,
      isComplete: true,
      lastWeekTotalSeconds: 3480,
    });
    expect(result).toBe(
      "Al-Kahf terminee ! 12/12 pages en 52m\nSemaine derniere : 58m (-6m, bravo !)",
    );
  });

  it("formats completion with last week comparison (slower)", () => {
    const result = formatKahfPageConfirmation({
      kahfPage: 12,
      kahfTotal: 12,
      durationSeconds: 300,
      weekPagesRead: 12,
      weekTotalSeconds: 3480,
      isComplete: true,
      lastWeekTotalSeconds: 3300,
    });
    expect(result).toBe(
      "Al-Kahf terminee ! 12/12 pages en 58m\nSemaine derniere : 55m (+3m)",
    );
  });

  it("formats completion with same time as last week", () => {
    const result = formatKahfPageConfirmation({
      kahfPage: 12,
      kahfTotal: 12,
      durationSeconds: 300,
      weekPagesRead: 12,
      weekTotalSeconds: 3120,
      isComplete: true,
      lastWeekTotalSeconds: 3120,
    });
    expect(result).toBe(
      "Al-Kahf terminee ! 12/12 pages en 52m\nSemaine derniere : 52m",
    );
  });
});

// --- formatKahfReminder ---

describe("formatKahfReminder", () => {
  it("formats with history", () => {
    const result = formatKahfReminder({
      lastDate: "2026-03-07 14:00:00",
      lastDuration: 1500,
    });
    expect(result).toBe(
      "Rappel : c'est vendredi ! Pense a lire sourate Al-Kahf.\n\nDerniere lecture : 07/03 en 25m",
    );
  });

  it("formats without history", () => {
    const result = formatKahfReminder({});
    expect(result).toBe("Rappel : c'est vendredi ! Pense a lire sourate Al-Kahf.");
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
    const result = formatHistoryLine({ ...baseSession, type: "normal" });
    expect(result).toBe("[N] #42 | 10/03 13h30 | 8m53 | Al-Baqara 2:77-83 (7v)");
  });

  it("formats with [E] tag for extra type", () => {
    const result = formatHistoryLine({ ...baseSession, type: "extra" });
    expect(result).toBe("[E] #42 | 10/03 13h30 | 8m53 | Al-Baqara 2:77-83 (7v)");
  });

  it("formats with [K] tag for kahf type", () => {
    const result = formatHistoryLine({ ...baseSession, type: "kahf" });
    expect(result).toBe("[K] #42 | 10/03 13h30 | 8m53 | Al-Baqara 2:77-83 (7v)");
  });
});

// --- formatSessionConfirmation with type ---

describe("formatSessionConfirmation with type", () => {
  it("formats extra session", () => {
    const result = formatSessionConfirmation({
      surahStart: 2,
      ayahStart: 77,
      surahEnd: 2,
      ayahEnd: 83,
      ayahCount: 7,
      durationSeconds: 533,
      type: "extra",
    });
    expect(result).toBe(
      "Session extra enregistree : sourate Al-Baqara v.77 a v.83 -- 7 versets en 8m53",
    );
  });
});

// --- formatEstimation ---

describe("formatEstimation", () => {
  const today = "2026-03-15";

  it("formate une date de fin avec un rythme normal", () => {
    // 1.2 pages/jour, 400 pages restantes -> ceil(333.3) = 334 jours -> 2027-02-12
    const result = formatEstimation(1.2, 400, today);
    expect(result).toBe("A ce rythme (~1.2 pages/jour), tu finiras vers le 12 fevrier 2027");
  });

  it("retourne message 'pas assez de donnees' quand pace est 0", () => {
    const result = formatEstimation(0, 400, today);
    expect(result).toBe("Pas assez de donnees recentes pour estimer (lis regulierement pour voir une projection)");
  });

  it("retourne format en mois quand estimation > 5 ans", () => {
    // 0.1 pages/jour, 500 pages = 5000 jours > 5*365
    const result = formatEstimation(0.1, 500, today);
    expect(result).toMatch(/^A ton rythme actuel \(~0\.1 pages\/jour\), il te reste environ \d+ mois$/);
  });

  it("retourne message pour pace negatif", () => {
    const result = formatEstimation(-1, 400, today);
    expect(result).toBe("Pas assez de donnees recentes pour estimer (lis regulierement pour voir une projection)");
  });
});

// --- formatError ---

describe("formatError", () => {
  it("formats error with example", () => {
    expect(formatError("description ici", "2:77-83")).toBe(
      "Erreur : description ici\nExemple : 2:77-83",
    );
  });

  it("formats error without example", () => {
    expect(formatError("description ici")).toBe("Erreur : description ici");
  });
});
