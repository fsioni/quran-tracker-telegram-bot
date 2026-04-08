import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/db/config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/db/config")>();
  return { ...actual, getConfig: vi.fn(), setConfig: vi.fn() };
});
vi.mock("../src/services/db/date-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/db/date-helpers")>();
  return { ...actual, getTodayInTimezone: vi.fn() };
});
vi.mock("../src/services/db/kahf", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/db/kahf")>();
  return {
    ...actual,
    calculateKahfPagesRead: vi.fn(),
    getKahfSessionsThisWeek: vi.fn(),
    getKahfStats: vi.fn(),
  };
});
vi.mock("../src/services/db/prayer", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/db/prayer")>();
  return {
    ...actual,
    getPrayerCache: vi.fn(),
    setPrayerCache: vi.fn(),
    markPrayerSent: vi.fn(),
    markStreakFollowupSent: vi.fn(),
    cleanOldCache: vi.fn(),
  };
});
vi.mock("../src/services/db/sessions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/db/sessions")>();
  return { ...actual, getLastSession: vi.fn(), hasSessionToday: vi.fn() };
});
vi.mock("../src/services/db/stats", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/db/stats")>();
  return { ...actual, getPeriodStats: vi.fn(), calculateStreak: vi.fn() };
});

vi.mock("../src/services/prayer", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/prayer")>();
  return {
    ...actual,
    addMinutesToHHMM: vi.fn(),
    fetchPrayerTimes: vi.fn(),
    getDueReminders: vi.fn(),
    getNowInTimezone: vi.fn(),
    isReminderDue: vi.fn(),
  };
});

vi.mock("../src/services/format", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/format")>();
  return {
    ...actual,
    formatReminder: vi.fn(),
    formatStreakFollowup: vi.fn(),
    formatKahfReminder: vi.fn(),
    formatWeeklyRecap: vi.fn(),
  };
});

vi.mock("../src/services/weekly-recap", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/weekly-recap")>();
  return { ...actual, buildWeeklyRecap: vi.fn() };
});

import { handleScheduled } from "../src/index";
import { fr } from "../src/locales/fr";
import { getConfig, setConfig } from "../src/services/db/config";
import { getTodayInTimezone } from "../src/services/db/date-helpers";
import {
  calculateKahfPagesRead,
  getKahfSessionsThisWeek,
  getKahfStats,
} from "../src/services/db/kahf";
import {
  cleanOldCache,
  getPrayerCache,
  markPrayerSent,
  markStreakFollowupSent,
  setPrayerCache,
} from "../src/services/db/prayer";
import { getLastSession, hasSessionToday } from "../src/services/db/sessions";
import { calculateStreak, getPeriodStats } from "../src/services/db/stats";
import {
  formatKahfReminder,
  formatReminder,
  formatStreakFollowup,
  formatWeeklyRecap,
} from "../src/services/format";
import {
  addMinutesToHHMM,
  fetchPrayerTimes,
  getDueReminders,
  getNowInTimezone,
  isReminderDue,
} from "../src/services/prayer";
import { buildWeeklyRecap } from "../src/services/weekly-recap";

function mockConfigValues(values: Record<string, string | null>) {
  vi.mocked(getConfig).mockImplementation((_, key) =>
    Promise.resolve(values[key] ?? null)
  );
}

describe("handleScheduled", () => {
  const db = {} as D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    // Default: no session today (for streak followup guard)
    vi.mocked(hasSessionToday).mockResolvedValue(false);
    // Default: isReminderDue returns false (streak followup won't fire unless explicitly set)
    vi.mocked(isReminderDue).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ne fait rien si chat_id absent", async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    await handleScheduled(db, "TOKEN");
    expect(getPrayerCache).not.toHaveBeenCalled();
  });

  it("ne fait rien si aucune priere dans la fenetre", async () => {
    mockConfigValues({
      chat_id: "123",
      timezone: "America/Cancun",
      city: "Playa del Carmen",
      country: "MX",
      language: "fr",
    });
    vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-14");
    vi.mocked(getPrayerCache).mockResolvedValue({
      date: "2026-03-14",
      fajr: "05:30",
      dhuhr: "12:00",
      asr: "15:45",
      maghrib: "18:30",
      isha: "20:00",
      fajr_sent: 0,
      dhuhr_sent: 0,
      asr_sent: 0,
      maghrib_sent: 0,
      isha_sent: 0,
      streak_followup_sent: 0,
      fetched_at: "2026-03-14",
    });
    vi.mocked(getNowInTimezone).mockReturnValue("14:00");
    vi.mocked(getDueReminders).mockReturnValue([]);

    await handleScheduled(db, "TOKEN");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("envoie un rappel et marque la priere", async () => {
    mockConfigValues({
      chat_id: "123",
      timezone: "America/Cancun",
      city: "PDC",
      country: "MX",
      language: "fr",
    });
    vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-14");
    vi.mocked(getPrayerCache).mockResolvedValue({
      date: "2026-03-14",
      fajr: "05:30",
      dhuhr: "12:00",
      asr: "15:45",
      maghrib: "18:30",
      isha: "20:00",
      fajr_sent: 0,
      dhuhr_sent: 0,
      asr_sent: 0,
      maghrib_sent: 0,
      isha_sent: 0,
      streak_followup_sent: 0,
      fetched_at: "2026-03-14",
    });
    vi.mocked(getNowInTimezone).mockReturnValue("12:12");
    vi.mocked(getDueReminders).mockReturnValue(["dhuhr"]);
    vi.mocked(getLastSession).mockResolvedValue({
      id: 1,
      startedAt: "2026-03-13 20:00:00",
      durationSeconds: 500,
      surahStart: 2,
      ayahStart: 77,
      surahEnd: 2,
      ayahEnd: 83,
      ayahCount: 7,
      createdAt: "2026-03-13",
      pageStart: 10,
      pageEnd: 12,
      type: "normal",
    });
    vi.mocked(getPeriodStats).mockResolvedValue({
      ok: true,
      value: {
        sessions: 3,
        ayahs: 45,
        seconds: 2000,
        pages: 0,
        pageSeconds: 0,
      },
    });
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 5,
      bestStreak: 10,
    });
    vi.mocked(formatReminder).mockReturnValue("Rappel test");

    await handleScheduled(db, "TOKEN");

    expect(getLastSession).toHaveBeenCalledWith(db, "normal");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botTOKEN/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: "123",
          text: "Rappel test",
          reply_markup: {
            inline_keyboard: [[{ text: "Go", callback_data: "timer_go" }]],
          },
        }),
      })
    );
    expect(markPrayerSent).toHaveBeenCalledWith(db, "2026-03-14", "dhuhr");
  });

  it("fetch Aladhan si cache absent", async () => {
    mockConfigValues({
      chat_id: "123",
      timezone: "America/Cancun",
      city: "PDC",
      country: "MX",
      language: "fr",
    });
    vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-14");
    vi.mocked(getPrayerCache).mockResolvedValueOnce(null);
    vi.mocked(fetchPrayerTimes).mockResolvedValue({
      ok: true,
      value: {
        date: "2026-03-14",
        fajr: "05:30",
        dhuhr: "12:00",
        asr: "15:45",
        maghrib: "18:30",
        isha: "20:00",
      },
    });
    vi.mocked(getNowInTimezone).mockReturnValue("14:00");
    vi.mocked(getDueReminders).mockReturnValue([]);

    await handleScheduled(db, "TOKEN");

    expect(fetchPrayerTimes).toHaveBeenCalledWith(
      "2026-03-14",
      "PDC",
      "MX",
      fr
    );
    expect(setPrayerCache).toHaveBeenCalled();
    // cleanOldCache is called every run, not just on cache miss
    expect(cleanOldCache).toHaveBeenCalledWith(db, "2026-03-14");
  });

  it("ne marque pas la priere si Telegram echoue", async () => {
    mockConfigValues({
      chat_id: "123",
      timezone: "America/Cancun",
      city: "PDC",
      country: "MX",
      language: "fr",
    });
    vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-14");
    vi.mocked(getPrayerCache).mockResolvedValue({
      date: "2026-03-14",
      fajr: "05:30",
      dhuhr: "12:00",
      asr: "15:45",
      maghrib: "18:30",
      isha: "20:00",
      fajr_sent: 0,
      dhuhr_sent: 0,
      asr_sent: 0,
      maghrib_sent: 0,
      isha_sent: 0,
      streak_followup_sent: 0,
      fetched_at: "2026-03-14",
    });
    vi.mocked(getNowInTimezone).mockReturnValue("12:12");
    vi.mocked(getDueReminders).mockReturnValue(["dhuhr"]);
    vi.mocked(getLastSession).mockResolvedValue(null);
    vi.mocked(getPeriodStats).mockResolvedValue({
      ok: true,
      value: { sessions: 0, ayahs: 0, seconds: 0, pages: 0, pageSeconds: 0 },
    });
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 0,
      bestStreak: 0,
    });
    vi.mocked(formatReminder).mockReturnValue("Rappel test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );

    await handleScheduled(db, "TOKEN");

    expect(markPrayerSent).not.toHaveBeenCalled();
  });

  it("envoie rappel avec nextPage=1 si aucune session", async () => {
    mockConfigValues({ chat_id: "123", language: "fr" });
    vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-14");
    vi.mocked(getPrayerCache).mockResolvedValue({
      date: "2026-03-14",
      fajr: "05:30",
      dhuhr: "12:00",
      asr: "15:45",
      maghrib: "18:30",
      isha: "20:00",
      fajr_sent: 0,
      dhuhr_sent: 0,
      asr_sent: 0,
      maghrib_sent: 0,
      isha_sent: 0,
      streak_followup_sent: 0,
      fetched_at: "2026-03-14",
    });
    vi.mocked(getNowInTimezone).mockReturnValue("12:12");
    vi.mocked(getDueReminders).mockReturnValue(["dhuhr"]);
    vi.mocked(getLastSession).mockResolvedValue(null);
    vi.mocked(getPeriodStats).mockResolvedValue({
      ok: true,
      value: { sessions: 0, ayahs: 0, seconds: 0, pages: 0, pageSeconds: 0 },
    });
    vi.mocked(calculateStreak).mockResolvedValue({
      currentStreak: 0,
      bestStreak: 0,
    });
    vi.mocked(formatReminder).mockReturnValue("Rappel page 1");

    await handleScheduled(db, "TOKEN");

    expect(formatReminder).toHaveBeenCalledWith(
      expect.objectContaining({ nextPage: 1 }),
      expect.anything()
    );
  });

  describe("Al-Kahf Friday reminder", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("envoie le rappel Al-Kahf le vendredi apres Fajr", async () => {
      // 2026-03-13 is a Friday
      vi.setSystemTime(new Date("2026-03-13T12:00:00Z"));

      mockConfigValues({
        chat_id: "123",
        timezone: "America/Cancun",
        city: "PDC",
        country: "MX",
        language: "fr",
      });
      vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-13");
      vi.mocked(getPrayerCache).mockResolvedValue({
        date: "2026-03-13",
        fajr: "05:30",
        dhuhr: "12:00",
        asr: "15:45",
        maghrib: "18:30",
        isha: "20:00",
        fajr_sent: 0,
        dhuhr_sent: 0,
        asr_sent: 0,
        maghrib_sent: 0,
        isha_sent: 0,
        fetched_at: "2026-03-13",
      });
      vi.mocked(getNowInTimezone).mockReturnValue("05:42");
      vi.mocked(getDueReminders).mockReturnValue([]);
      vi.mocked(isReminderDue).mockReturnValue(true);
      vi.mocked(getKahfStats).mockResolvedValue({
        lastDuration: null,
        lastDate: null,
      });
      vi.mocked(getKahfSessionsThisWeek).mockResolvedValue([]);
      vi.mocked(calculateKahfPagesRead).mockReturnValue(0);
      vi.mocked(formatKahfReminder).mockReturnValue("Rappel Al-Kahf");

      await handleScheduled(db, "TOKEN");

      expect(formatKahfReminder).toHaveBeenCalledWith(
        {
          lastDate: undefined,
          lastDuration: undefined,
          nextKahfPage: 293,
        },
        fr
      );
      expect(fetch).toHaveBeenCalledWith(
        "https://api.telegram.org/botTOKEN/sendMessage",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ chat_id: "123", text: "Rappel Al-Kahf" }),
        })
      );
      expect(setConfig).toHaveBeenCalledWith(
        db,
        "kahf_reminder_last",
        "2026-03-13"
      );
    });

    it("pas de rappel Al-Kahf en dehors du vendredi", async () => {
      // 2026-03-11 is a Wednesday
      vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));

      mockConfigValues({
        chat_id: "123",
        timezone: "America/Cancun",
        city: "PDC",
        country: "MX",
        language: "fr",
      });
      vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-11");
      vi.mocked(getPrayerCache).mockResolvedValue({
        date: "2026-03-11",
        fajr: "05:30",
        dhuhr: "12:00",
        asr: "15:45",
        maghrib: "18:30",
        isha: "20:00",
        fajr_sent: 0,
        dhuhr_sent: 0,
        asr_sent: 0,
        maghrib_sent: 0,
        isha_sent: 0,
        fetched_at: "2026-03-11",
      });
      vi.mocked(getNowInTimezone).mockReturnValue("05:42");
      vi.mocked(getDueReminders).mockReturnValue([]);

      await handleScheduled(db, "TOKEN");

      expect(formatKahfReminder).not.toHaveBeenCalled();
    });

    it("pas de double rappel Al-Kahf le meme vendredi", async () => {
      // 2026-03-13 is a Friday
      vi.setSystemTime(new Date("2026-03-13T12:00:00Z"));

      mockConfigValues({
        chat_id: "123",
        timezone: "America/Cancun",
        city: "PDC",
        country: "MX",
        kahf_reminder_last: "2026-03-13",
        language: "fr",
      });
      vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-13");
      vi.mocked(getPrayerCache).mockResolvedValue({
        date: "2026-03-13",
        fajr: "05:30",
        dhuhr: "12:00",
        asr: "15:45",
        maghrib: "18:30",
        isha: "20:00",
        fajr_sent: 0,
        dhuhr_sent: 0,
        asr_sent: 0,
        maghrib_sent: 0,
        isha_sent: 0,
        fetched_at: "2026-03-13",
      });
      vi.mocked(getNowInTimezone).mockReturnValue("05:42");
      vi.mocked(getDueReminders).mockReturnValue([]);

      await handleScheduled(db, "TOKEN");

      expect(formatKahfReminder).not.toHaveBeenCalled();
    });

    it("rappel Al-Kahf inclut infos derniere lecture si disponibles", async () => {
      // 2026-03-13 is a Friday
      vi.setSystemTime(new Date("2026-03-13T12:00:00Z"));

      mockConfigValues({
        chat_id: "123",
        timezone: "America/Cancun",
        city: "PDC",
        country: "MX",
        language: "fr",
      });
      vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-13");
      vi.mocked(getPrayerCache).mockResolvedValue({
        date: "2026-03-13",
        fajr: "05:30",
        dhuhr: "12:00",
        asr: "15:45",
        maghrib: "18:30",
        isha: "20:00",
        fajr_sent: 0,
        dhuhr_sent: 0,
        asr_sent: 0,
        maghrib_sent: 0,
        isha_sent: 0,
        fetched_at: "2026-03-13",
      });
      vi.mocked(getNowInTimezone).mockReturnValue("05:42");
      vi.mocked(getDueReminders).mockReturnValue([]);
      vi.mocked(isReminderDue).mockReturnValue(true);
      vi.mocked(getKahfStats).mockResolvedValue({
        lastDuration: 1500,
        lastDate: "2026-03-07",
      });
      vi.mocked(getKahfSessionsThisWeek).mockResolvedValue([]);
      vi.mocked(calculateKahfPagesRead).mockReturnValue(3);
      vi.mocked(formatKahfReminder).mockReturnValue(
        "Rappel Al-Kahf avec stats"
      );

      await handleScheduled(db, "TOKEN");

      expect(formatKahfReminder).toHaveBeenCalledWith(
        {
          lastDate: "2026-03-07",
          lastDuration: 1500,
          nextKahfPage: 296,
        },
        fr
      );
    });
  });

  describe("Weekly recap Sunday", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function setupSundayMocks(
      overrides: {
        nowHHMM?: string;
        recapLast?: string | null;
        dayOfWeek?: string;
        date?: string;
      } = {}
    ) {
      const date = overrides.date ?? "2026-03-15";
      // 2026-03-15 is a Sunday
      vi.setSystemTime(
        new Date(
          `${date}T${overrides.nowHHMM === "20:30" ? "20:30" : "21:05"}:00Z`
        )
      );

      mockConfigValues({
        chat_id: "123",
        timezone: "UTC",
        city: "PDC",
        country: "MX",
        weekly_recap_last: overrides.recapLast ?? null,
        language: "fr",
      });
      vi.mocked(getTodayInTimezone).mockReturnValue(date);
      vi.mocked(getPrayerCache).mockResolvedValue({
        date,
        fajr: "05:30",
        dhuhr: "12:00",
        asr: "15:45",
        maghrib: "18:30",
        isha: "20:00",
        fajr_sent: 1,
        dhuhr_sent: 1,
        asr_sent: 1,
        maghrib_sent: 1,
        isha_sent: 1,
        streak_followup_sent: 0,
        fetched_at: date,
      });
      vi.mocked(getNowInTimezone).mockReturnValue(overrides.nowHHMM ?? "21:05");
      vi.mocked(getDueReminders).mockReturnValue([]);
    }

    it("envoie le recap le dimanche a 21h+", async () => {
      setupSundayMocks();
      vi.mocked(buildWeeklyRecap).mockResolvedValue({
        ok: true,
        value: {
          thisWeek: {
            sessions: 5,
            ayahs: 100,
            seconds: 3000,
            pages: 0,
            pageSeconds: 0,
          },
          lastWeek: {
            sessions: 4,
            ayahs: 80,
            seconds: 2500,
            pages: 0,
            pageSeconds: 0,
          },
          thisWeekPages: 12,
          lastWeekPages: 10,
          streak: { currentStreak: 8, bestStreak: 15 },
          completedSurahs: [],
        },
      });
      vi.mocked(formatWeeklyRecap).mockReturnValue("Recap test");

      await handleScheduled(db, "TOKEN");

      expect(buildWeeklyRecap).toHaveBeenCalledWith(db, "UTC");
      expect(formatWeeklyRecap).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith(
        "https://api.telegram.org/botTOKEN/sendMessage",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ chat_id: "123", text: "Recap test" }),
        })
      );
      expect(setConfig).toHaveBeenCalledWith(
        db,
        "weekly_recap_last",
        "2026-03-15"
      );
    });

    it("pas d'envoi en dehors du dimanche", async () => {
      // 2026-03-11 is a Wednesday
      vi.setSystemTime(new Date("2026-03-11T21:05:00Z"));

      mockConfigValues({
        chat_id: "123",
        timezone: "UTC",
        city: "PDC",
        country: "MX",
        language: "fr",
      });
      vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-11");
      vi.mocked(getPrayerCache).mockResolvedValue({
        date: "2026-03-11",
        fajr: "05:30",
        dhuhr: "12:00",
        asr: "15:45",
        maghrib: "18:30",
        isha: "20:00",
        fajr_sent: 1,
        dhuhr_sent: 1,
        asr_sent: 1,
        maghrib_sent: 1,
        isha_sent: 1,
        streak_followup_sent: 0,
        fetched_at: "2026-03-11",
      });
      vi.mocked(getNowInTimezone).mockReturnValue("21:05");
      vi.mocked(getDueReminders).mockReturnValue([]);

      await handleScheduled(db, "TOKEN");

      expect(buildWeeklyRecap).not.toHaveBeenCalled();
    });

    it("pas d'envoi si weekly_recap_last == today (guard anti-double)", async () => {
      setupSundayMocks({ recapLast: "2026-03-15" });

      await handleScheduled(db, "TOKEN");

      expect(buildWeeklyRecap).not.toHaveBeenCalled();
    });

    it("pas d'envoi avant 21h le dimanche", async () => {
      setupSundayMocks({ nowHHMM: "20:30" });

      await handleScheduled(db, "TOKEN");

      expect(buildWeeklyRecap).not.toHaveBeenCalled();
    });
  });

  describe("Streak followup reminder", () => {
    function setupFollowupMocks(
      overrides: {
        streakFollowupSent?: number;
        ishaSent?: number;
        isFollowupDue?: boolean;
        readToday?: boolean;
        currentStreak?: number;
      } = {}
    ) {
      mockConfigValues({
        chat_id: "123",
        timezone: "America/Cancun",
        city: "PDC",
        country: "MX",
        language: "fr",
      });
      vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-14");
      vi.mocked(getPrayerCache).mockResolvedValue({
        date: "2026-03-14",
        fajr: "05:30",
        dhuhr: "12:00",
        asr: "15:45",
        maghrib: "18:30",
        isha: "20:00",
        fajr_sent: 1,
        dhuhr_sent: 1,
        asr_sent: 1,
        maghrib_sent: 1,
        isha_sent: overrides.ishaSent ?? 1,
        streak_followup_sent: overrides.streakFollowupSent ?? 0,
        fetched_at: "2026-03-14",
      });
      vi.mocked(getNowInTimezone).mockReturnValue("21:30");
      vi.mocked(getDueReminders).mockReturnValue([]);
      // isReminderDue is called for the followup check
      vi.mocked(isReminderDue).mockReturnValue(overrides.isFollowupDue ?? true);
      vi.mocked(addMinutesToHHMM).mockReturnValue("21:30");
      vi.mocked(hasSessionToday).mockResolvedValue(
        overrides.readToday ?? false
      );
      vi.mocked(calculateStreak).mockResolvedValue({
        currentStreak: overrides.currentStreak ?? 5,
        bestStreak: 10,
      });
      vi.mocked(formatStreakFollowup).mockReturnValue("Derniere chance");
    }

    it("envoie le followup quand toutes les conditions sont remplies", async () => {
      setupFollowupMocks();

      await handleScheduled(db, "TOKEN");

      expect(formatStreakFollowup).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith(
        "https://api.telegram.org/botTOKEN/sendMessage",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            chat_id: "123",
            text: "Derniere chance",
            reply_markup: {
              inline_keyboard: [[{ text: "Go", callback_data: "timer_go" }]],
            },
          }),
        })
      );
      expect(markStreakFollowupSent).toHaveBeenCalledWith(db, "2026-03-14");
    });

    it("pas de followup si deja envoye", async () => {
      setupFollowupMocks({ streakFollowupSent: 1 });

      await handleScheduled(db, "TOKEN");

      expect(formatStreakFollowup).not.toHaveBeenCalled();
    });

    it("pas de followup si isha pas encore envoye", async () => {
      setupFollowupMocks({ ishaSent: 0 });

      await handleScheduled(db, "TOKEN");

      expect(formatStreakFollowup).not.toHaveBeenCalled();
    });

    it("pas de followup si trop tot", async () => {
      setupFollowupMocks({ isFollowupDue: false });

      await handleScheduled(db, "TOKEN");

      expect(formatStreakFollowup).not.toHaveBeenCalled();
    });

    it("pas de followup si l'utilisateur a lu aujourd'hui", async () => {
      setupFollowupMocks({ readToday: true });

      await handleScheduled(db, "TOKEN");

      expect(formatStreakFollowup).not.toHaveBeenCalled();
    });

    it("pas de followup si streak < 2", async () => {
      setupFollowupMocks({ currentStreak: 1 });

      await handleScheduled(db, "TOKEN");

      expect(formatStreakFollowup).not.toHaveBeenCalled();
    });
  });
});
