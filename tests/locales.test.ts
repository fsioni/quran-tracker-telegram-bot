import { describe, expect, it } from "vitest";
import {
  buildWelcome,
  getBotCommands,
  getLocale,
  LANGUAGES,
} from "../src/locales";
import { ar } from "../src/locales/ar";
import { en } from "../src/locales/en";
import { fr } from "../src/locales/fr";
import type { Locale } from "../src/locales/types";
import {
  formatError,
  formatEstimation,
  formatHistoryLine,
  formatKahfReminder,
  formatKhatmaMessage,
  formatProgress,
  formatReadConfirmation,
  formatReminder,
  formatSessionConfirmation,
  formatSpeedReport,
  formatStats,
  formatSurahsComplete,
  formatWeeklyRecap,
} from "../src/services/format";

const locales: [string, Locale][] = [
  ["en", en],
  ["fr", fr],
  ["ar", ar],
];

function walkKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, val]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return walkKeys(val as Record<string, unknown>, path);
    }
    return [path];
  });
}

describe("locale key exhaustiveness", () => {
  it("all locales have identical key structures", () => {
    const enKeys = walkKeys(en as unknown as Record<string, unknown>).sort();
    const frKeys = walkKeys(fr as unknown as Record<string, unknown>).sort();
    const arKeys = walkKeys(ar as unknown as Record<string, unknown>).sort();
    expect(frKeys).toEqual(enKeys);
    expect(arKeys).toEqual(enKeys);
  });

  it("no locale has empty string values", () => {
    for (const [name, locale] of locales) {
      const keys = walkKeys(locale as unknown as Record<string, unknown>);
      for (const keyPath of keys) {
        const parts = keyPath.split(".");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let val: any = locale;
        for (const part of parts) {
          val = val[part];
        }
        if (typeof val === "string") {
          expect(val, `${name}: key "${keyPath}" must not be empty`).not.toBe(
            ""
          );
        }
      }
    }
  });

  it("no template function returns empty string", () => {
    for (const [name, locale] of locales) {
      const keys = walkKeys(locale as unknown as Record<string, unknown>);
      for (const keyPath of keys) {
        const parts = keyPath.split(".");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let val: any = locale;
        for (const part of parts) {
          val = val[part];
        }
        if (typeof val === "function") {
          const args = Array.from({ length: val.length }, (_, i) =>
            i % 2 === 0 ? "test" : 1
          );
          const result = val(...args);
          expect(
            typeof result,
            `${name}: key "${keyPath}" must return a string`
          ).toBe("string");
          expect(
            result,
            `${name}: key "${keyPath}" must return a non-empty string`
          ).not.toBe("");
        }
      }
    }
  });
});

describe("locale completeness", () => {
  it.each(
    locales
  )("%s: all template functions return non-empty strings", (_, t) => {
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
    for (const m of t.months) {
      expect(m).toBeTruthy();
    }
  });

  it.each(locales)("%s: format functions produce non-empty output", (_, t) => {
    expect(
      formatSessionConfirmation(
        {
          surahStart: 2,
          ayahStart: 77,
          surahEnd: 2,
          ayahEnd: 83,
          ayahCount: 7,
          durationSeconds: 533,
        },
        t
      )
    ).toBeTruthy();

    expect(
      formatHistoryLine(
        {
          id: 1,
          startedAt: "2026-03-13 14:00:00",
          durationSeconds: 533,
          surahStart: 2,
          ayahStart: 77,
          surahEnd: 2,
          ayahEnd: 83,
          ayahCount: 7,
        },
        t
      )
    ).toBeTruthy();

    expect(
      formatStats(
        {
          totalAyahs: 300,
          totalSeconds: 5000,
          currentStreak: 5,
          bestStreak: 10,
          weekAyahs: 50,
          weekSeconds: 1000,
          monthAyahs: 200,
          monthSeconds: 4000,
        },
        t
      )
    ).toBeTruthy();

    expect(
      formatProgress(
        {
          totalAyahsRead: 300,
          totalAyahs: 6236,
          nextPage: 42,
        },
        t
      )
    ).toBeTruthy();

    expect(
      formatReminder(
        {
          lastSessionDate: "2026-03-13 14:00:00",
          lastSurahNum: 2,
          lastAyah: 83,
          weekSessions: 5,
          weekAyahs: 50,
          streak: 3,
        },
        t
      )
    ).toBeTruthy();

    expect(
      formatReadConfirmation(
        {
          pageStart: 10,
          pageEnd: 10,
          durationSeconds: 300,
          totalPagesRead: 10,
          totalPages: 604,
        },
        t
      )
    ).toBeTruthy();

    expect(formatKahfReminder({}, t)).toBeTruthy();
    expect(
      formatKahfReminder(
        { lastDate: "2026-03-07 10:00:00", lastDuration: 600 },
        t
      )
    ).toBeTruthy();

    expect(formatEstimation(2.5, 500, "2026-03-13", t)).toBeTruthy();
    expect(formatKhatmaMessage(1, t)).toBeTruthy();
    expect(formatKhatmaMessage(3, t)).toBeTruthy();
    expect(
      formatSurahsComplete([{ number: 1, name: "Al-Fatiha" }], t)
    ).toBeTruthy();

    expect(formatError("test error", t)).toBeTruthy();
    expect(formatError("test error", t, "/example")).toBeTruthy();

    expect(
      formatSpeedReport(
        {
          averages: { global: 150, last7Days: 160, last30Days: 140 },
          bestSession: null,
          longestSession: null,
          byType: [],
        },
        t
      )
    ).toBeTruthy();

    expect(
      formatWeeklyRecap(
        {
          thisWeek: { sessions: 5, ayahs: 100, seconds: 3000 },
          lastWeek: { sessions: 4, ayahs: 80, seconds: 2500 },
          thisWeekPages: 12,
          lastWeekPages: 10,
          streak: { currentStreak: 8, bestStreak: 15 },
          completedSurahs: [],
        },
        t
      )
    ).toBeTruthy();
  });
});

describe("format functions match snapshots", () => {
  it.each(locales)("%s: format snapshots", (_, t) => {
    expect(
      formatSessionConfirmation(
        {
          surahStart: 2,
          ayahStart: 77,
          surahEnd: 2,
          ayahEnd: 83,
          ayahCount: 7,
          durationSeconds: 533,
        },
        t
      )
    ).toMatchSnapshot();

    expect(
      formatHistoryLine(
        {
          id: 1,
          startedAt: "2026-03-13 14:00:00",
          durationSeconds: 533,
          surahStart: 2,
          ayahStart: 77,
          surahEnd: 2,
          ayahEnd: 83,
          ayahCount: 7,
        },
        t
      )
    ).toMatchSnapshot();

    expect(
      formatStats(
        {
          totalAyahs: 300,
          totalSeconds: 5000,
          currentStreak: 5,
          bestStreak: 10,
          weekAyahs: 50,
          weekSeconds: 1000,
          monthAyahs: 200,
          monthSeconds: 4000,
        },
        t
      )
    ).toMatchSnapshot();

    expect(
      formatProgress(
        {
          totalAyahsRead: 300,
          totalAyahs: 6236,
          nextPage: 42,
        },
        t
      )
    ).toMatchSnapshot();

    expect(
      formatReminder(
        {
          lastSessionDate: "2026-03-13 14:00:00",
          lastSurahNum: 2,
          lastAyah: 83,
          weekSessions: 5,
          weekAyahs: 50,
          streak: 3,
        },
        t
      )
    ).toMatchSnapshot();

    expect(
      formatReadConfirmation(
        {
          pageStart: 10,
          pageEnd: 10,
          durationSeconds: 300,
          totalPagesRead: 10,
          totalPages: 604,
        },
        t
      )
    ).toMatchSnapshot();

    expect(formatKahfReminder({}, t)).toMatchSnapshot();
    expect(
      formatKahfReminder(
        { lastDate: "2026-03-07 10:00:00", lastDuration: 600 },
        t
      )
    ).toMatchSnapshot();

    expect(formatEstimation(2.5, 500, "2026-03-13", t)).toMatchSnapshot();
    expect(formatKhatmaMessage(1, t)).toMatchSnapshot();
    expect(formatKhatmaMessage(3, t)).toMatchSnapshot();
    expect(
      formatSurahsComplete([{ number: 1, name: "Al-Fatiha" }], t)
    ).toMatchSnapshot();

    expect(formatError("test error", t)).toMatchSnapshot();
    expect(formatError("test error", t, "/example")).toMatchSnapshot();

    expect(
      formatSpeedReport(
        {
          averages: { global: 150, last7Days: 160, last30Days: 140 },
          bestSession: null,
          longestSession: null,
          byType: [],
        },
        t
      )
    ).toMatchSnapshot();

    expect(
      formatWeeklyRecap(
        {
          thisWeek: { sessions: 5, ayahs: 100, seconds: 3000 },
          lastWeek: { sessions: 4, ayahs: 80, seconds: 2500 },
          thisWeekPages: 12,
          lastWeekPages: 10,
          streak: { currentStreak: 8, bestStreak: 15 },
          completedSurahs: [],
        },
        t
      )
    ).toMatchSnapshot();
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

  it("returns en for prototype pollution attempts", () => {
    expect(getLocale("__proto__")).toBe(en);
    expect(getLocale("constructor")).toBe(en);
    expect(getLocale("toString")).toBe(en);
  });
});

describe("getBotCommands", () => {
  it.each(
    locales
  )("%s: returns all commands with non-empty descriptions", (_, t) => {
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

describe("plural boundaries", () => {
  for (const [name, t] of locales) {
    describe(name, () => {
      it("stats.currentStreak handles n=0, n=1, n=2, n=5", () => {
        for (const n of [0, 1, 2, 5]) {
          const result = t.stats.currentStreak(n);
          expect(result).toBeTruthy();
          expect(result).toContain(String(n));
        }
      });

      it("stats.bestStreak handles n=0, n=1, n=2, n=5", () => {
        for (const n of [0, 1, 2, 5]) {
          const result = t.stats.bestStreak(n);
          expect(result).toBeTruthy();
          expect(result).toContain(String(n));
        }
      });

      it("reminder.thisWeek handles n=0, n=1, n=2, n=5", () => {
        for (const n of [0, 1, 2, 5]) {
          const result = t.reminder.thisWeek(n, 50);
          expect(result).toBeTruthy();
          expect(result).toContain(String(n));
        }
      });

      it("reminder.streak handles n=0, n=1, n=2, n=5", () => {
        for (const n of [0, 1, 2, 5]) {
          const result = t.reminder.streak(n);
          expect(result).toBeTruthy();
          expect(result).toContain(String(n));
        }
      });

      it("speed.sessionsCount handles n=0, n=1, n=2, n=5", () => {
        for (const n of [0, 1, 2, 5]) {
          const result = t.speed.sessionsCount(n);
          expect(result).toBeTruthy();
          expect(result).toContain(String(n));
        }
      });

      it("recap.streak handles n=0, n=1, n=2, n=5", () => {
        for (const n of [0, 1, 2, 5]) {
          const result = t.recap.streak(n);
          expect(result).toBeTruthy();
          expect(result).toContain(String(n));
        }
      });
    });
  }

  it("French uses singular for n=0", () => {
    expect(fr.stats.currentStreak(0)).toContain("jour");
    expect(fr.stats.currentStreak(0)).not.toContain("jours");
  });

  it("French uses singular for n=1", () => {
    expect(fr.stats.currentStreak(1)).toContain("jour");
    expect(fr.stats.currentStreak(1)).not.toContain("jours");
  });

  it("French uses plural for n=2", () => {
    expect(fr.stats.currentStreak(2)).toContain("jours");
  });
});

describe("locale lang field", () => {
  it("en locale has lang='en'", () => {
    expect(en.lang).toBe("en");
  });

  it("fr locale has lang='fr'", () => {
    expect(fr.lang).toBe("fr");
  });

  it("ar locale has lang='ar'", () => {
    expect(ar.lang).toBe("ar");
  });
});
