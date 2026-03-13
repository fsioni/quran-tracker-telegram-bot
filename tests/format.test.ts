import {
  parseDuration,
  parseRange,
  parseImportLine,
  formatDuration,
  formatSessionConfirmation,
  formatHistoryLine,
  formatStats,
  formatProgress,
  formatReminder,
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
  it("parses a complete import line", () => {
    const result = parseImportLine("10/03, 13h30 - 8m53 - 2:77-83", 2026);
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
    // December date when reference year is 2026 and current month is March
    // 15/12 is in the future relative to March, so it should use 2025
    const result = parseImportLine("15/12, 8h00 - 5m - 1:1-7", 2026);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.date).toBe("2025-12-15");
    }
  });

  it("rejects invalid line format", () => {
    const result = parseImportLine("invalid line");
    expect(result.ok).toBe(false);
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
  it("formats same-surah history line", () => {
    const result = formatHistoryLine({
      id: 42,
      startedAt: "2026-03-10T13:30:00Z",
      durationSeconds: 533,
      surahStart: 2,
      ayahStart: 77,
      surahEnd: 2,
      ayahEnd: 83,
      ayahCount: 7,
    });
    expect(result).toBe(
      "#42 | 10/03 13h30 | 8m53 | Al-Baqara 2:77-83 (7v)",
    );
  });

  it("formats cross-surah history line", () => {
    const result = formatHistoryLine({
      id: 42,
      startedAt: "2026-03-10T13:30:00Z",
      durationSeconds: 533,
      surahStart: 2,
      ayahStart: 280,
      surahEnd: 3,
      ayahEnd: 10,
      ayahCount: 17,
    });
    expect(result).toBe(
      "#42 | 10/03 13h30 | 8m53 | Al-Baqara 2:280 - Al-Imran 3:10 (17v)",
    );
  });
});

// --- formatStats ---

describe("formatStats", () => {
  it("formats full stats message", () => {
    const result = formatStats({
      totalSessions: 50,
      totalAyahs: 1200,
      totalSeconds: 18000,
      avgAyahsPerSession: 24,
      avgSecondsPerSession: 360,
      thisWeekSessions: 5,
      thisWeekAyahs: 120,
    });
    expect(result).toBe(
      [
        "Statistiques :",
        "- Sessions : 50 (5 cette semaine)",
        "- Versets : 1200 (120 cette semaine)",
        "- Temps total : 5h 0m",
        "- Moyenne : 24 versets/session en 6m",
      ].join("\n"),
    );
  });
});

// --- formatProgress ---

describe("formatProgress", () => {
  it("formats progress bar with percentage", () => {
    const result = formatProgress({
      totalAyahsRead: 2494,
      totalAyahs: 6236,
      lastSurah: 2,
      lastAyah: 83,
    });
    // 2494/6236 = ~40%, filled = round(8) = 8
    expect(result).toBe(
      "[########------------] 40.0%\nDernier point : sourate Al-Baqara v.83",
    );
  });

  it("formats 0% progress", () => {
    const result = formatProgress({
      totalAyahsRead: 0,
      totalAyahs: 6236,
      lastSurah: 1,
      lastAyah: 1,
    });
    expect(result).toBe(
      "[--------------------] 0.0%\nDernier point : sourate Al-Fatiha v.1",
    );
  });
});

// --- formatReminder ---

describe("formatReminder", () => {
  it("formats reminder with streak", () => {
    const result = formatReminder({
      lastSessionDate: "2026-03-10T13:30:00Z",
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
      lastSessionDate: "2026-03-10T13:30:00Z",
      lastSurahNum: 2,
      lastAyah: 83,
      weekSessions: 0,
      weekAyahs: 0,
      streak: 0,
    });
    expect(result).toContain("C'est le moment de reprendre !");
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
