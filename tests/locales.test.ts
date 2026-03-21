import { describe, it, expect } from "vitest";
import { en } from "../src/locales/en";
import { fr } from "../src/locales/fr";
import { getLocale, buildWelcome, getBotCommands, LANGUAGES } from "../src/locales";
import type { Locale } from "../src/locales";
import {
  formatSessionConfirmation,
  formatStats,
  formatProgress,
  formatReminder,
  formatReadConfirmation,
  formatKahfReminder,
  formatEstimation,
  formatKhatmaMessage,
  formatSurahsComplete,
  formatError,
  formatSpeedReport,
  formatWeeklyRecap,
  formatHistoryLine,
} from "../src/services/format";

const locales: [string, Locale][] = [["en", en], ["fr", fr]];

describe("locale completeness", () => {
  it.each(locales)("%s: all template functions return non-empty strings", (_, t) => {
    // Config templates
    expect(t.config.cityUpdated("Mecca")).toBeTruthy();
    expect(t.config.countryUpdated("SA")).toBeTruthy();
    expect(t.config.timezoneUpdated("UTC")).toBeTruthy();
    expect(t.config.unknownParam("foo")).toBeTruthy();
    expect(t.config.languageUpdated("en")).toBeTruthy();
    expect(t.config.languageInvalid("en, fr")).toBeTruthy();

    // Parse templates
    expect(t.parse.invalidVerseFormat("x")).toBeTruthy();
    expect(t.parse.invalidDurationFormat("x")).toBeTruthy();
    expect(t.parse.invalidRangeFormat("x")).toBeTruthy();
    expect(t.parse.invalidImportLineFormat("x")).toBeTruthy();
    expect(t.parse.invalidMonth("13")).toBeTruthy();
    expect(t.parse.invalidDay("32", "01", 31)).toBeTruthy();
    expect(t.parse.invalidPage(999, 604)).toBeTruthy();
    expect(t.parse.pageStartAfterEnd(10, 5)).toBeTruthy();
    expect(t.parse.invalidPageFormat("x")).toBeTruthy();
    expect(t.parse.invalidFormat("/example")).toBeTruthy();
    expect(t.parse.invalidPageCount("/example")).toBeTruthy();

    // Examples
    expect(t.examples.session).toBeTruthy();
    expect(t.examples.read).toBeTruthy();
    expect(t.examples.extra).toBeTruthy();
    expect(t.examples.kahf).toBeTruthy();
    expect(t.examples.import).toBeTruthy();

    // Format templates
    expect(t.fmt.dateShort("01", "03")).toBeTruthy();
    expect(t.fmt.timeShort("14", "30")).toBeTruthy();
    expect(t.fmt.versesPerHourCompact(100)).toBeTruthy();
    expect(t.fmt.pagesPerHourCompact("12.0")).toBeTruthy();

    // Session templates
    expect(t.session.versesPerHour(100)).toBeTruthy();
    expect(t.session.pagesPerHour("12.0")).toBeTruthy();

    // Khatma
    expect(t.khatma.first).toBeTruthy();
    expect(t.khatma.nth(2)).toBeTruthy();

    // Months
    expect(t.months).toHaveLength(12);
    t.months.forEach((m) => expect(m).toBeTruthy());
  });

  it.each(locales)("%s: format functions produce non-empty output", (_, t) => {
    expect(formatSessionConfirmation({
      surahStart: 2, ayahStart: 77, surahEnd: 2, ayahEnd: 83,
      ayahCount: 7, durationSeconds: 533,
    }, t)).toBeTruthy();

    expect(formatHistoryLine({
      id: 1, startedAt: "2026-03-13 14:00:00", durationSeconds: 533,
      surahStart: 2, ayahStart: 77, surahEnd: 2, ayahEnd: 83, ayahCount: 7,
    }, t)).toBeTruthy();

    expect(formatStats({
      totalAyahs: 300, totalSeconds: 5000, currentStreak: 5, bestStreak: 10,
      weekAyahs: 50, weekSeconds: 1000, monthAyahs: 200, monthSeconds: 4000,
    }, t)).toBeTruthy();

    expect(formatProgress({
      totalAyahsRead: 300, totalAyahs: 6236, lastSurah: 2, lastAyah: 100,
    }, t)).toBeTruthy();

    expect(formatReminder({
      lastSessionDate: "2026-03-13 14:00:00", lastSurahNum: 2, lastAyah: 83,
      weekSessions: 5, weekAyahs: 50, streak: 3,
    }, t)).toBeTruthy();

    expect(formatReadConfirmation({
      pageStart: 10, pageEnd: 10, durationSeconds: 300,
      totalPagesRead: 10, totalPages: 604,
    }, t)).toBeTruthy();

    expect(formatKahfReminder({}, t)).toBeTruthy();
    expect(formatKahfReminder({ lastDate: "2026-03-07 10:00:00", lastDuration: 600 }, t)).toBeTruthy();

    expect(formatEstimation(2.5, 500, "2026-03-13", t)).toBeTruthy();
    expect(formatKhatmaMessage(1, t)).toBeTruthy();
    expect(formatKhatmaMessage(3, t)).toBeTruthy();
    expect(formatSurahsComplete([{ number: 1, name: "Al-Fatiha" }], t)).toBeTruthy();

    expect(formatError("test error", t)).toBeTruthy();
    expect(formatError("test error", t, "/example")).toBeTruthy();

    expect(formatSpeedReport({
      averages: { global: 150, last7Days: 160, last30Days: 140 },
      bestSession: null, longestSession: null, byType: [],
    }, t)).toBeTruthy();

    expect(formatWeeklyRecap({
      thisWeek: { sessions: 5, ayahs: 100, seconds: 3000 },
      lastWeek: { sessions: 4, ayahs: 80, seconds: 2500 },
      thisWeekPages: 12, lastWeekPages: 10,
      streak: { currentStreak: 8, bestStreak: 15 },
      completedSurahs: [],
    }, t)).toBeTruthy();
  });
});

describe("getLocale", () => {
  it("returns en for null", () => {
    expect(getLocale(null)).toBe(en);
  });

  it("returns en for unknown language", () => {
    expect(getLocale("de")).toBe(en);
  });

  it("returns fr for 'fr'", () => {
    expect(getLocale("fr")).toBe(fr);
  });

  it("returns en for 'en'", () => {
    expect(getLocale("en")).toBe(en);
  });
});

describe("getBotCommands", () => {
  it.each(locales)("%s: returns all commands with non-empty descriptions", (_, t) => {
    const commands = getBotCommands(t);
    expect(commands.length).toBeGreaterThan(0);
    for (const cmd of commands) {
      expect(cmd.command).toBeTruthy();
      expect(cmd.description).toBeTruthy();
    }
  });
});

describe("buildWelcome", () => {
  it.each(locales)("%s: contains header and command lines", (_, t) => {
    const welcome = buildWelcome(t);
    expect(welcome).toContain(t.welcomeHeader);
    expect(welcome).toContain(t.commandsAvailable);
    expect(welcome).toContain("/help");
    expect(welcome).toContain("/stats");
    // start is excluded from welcome
    expect(welcome).not.toContain("/start");
  });
});

describe("LANGUAGES", () => {
  it("matches available locale files", () => {
    for (const lang of LANGUAGES) {
      const t = getLocale(lang);
      expect(t).toBeDefined();
      expect(t.welcomeHeader).toBeTruthy();
    }
  });
});
