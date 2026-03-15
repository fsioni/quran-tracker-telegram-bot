import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/db")>();
  return {
    ...actual,
    getConfig: vi.fn(),
    getPrayerCache: vi.fn(),
    setPrayerCache: vi.fn(),
    markPrayerSent: vi.fn(),
    getLastSession: vi.fn(),
    getPeriodStats: vi.fn(),
    calculateStreak: vi.fn(),
    getTodayInTimezone: vi.fn(),
    cleanOldCache: vi.fn(),
    getKahfStats: vi.fn(),
    setConfig: vi.fn(),
  };
});

vi.mock("../src/services/prayer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/prayer")>();
  return {
    ...actual,
    fetchPrayerTimes: vi.fn(),
    getDueReminders: vi.fn(),
    getNowInTimezone: vi.fn(),
    isReminderTime: vi.fn(),
  };
});

vi.mock("../src/services/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/format")>();
  return { ...actual, formatReminder: vi.fn(), formatKahfReminder: vi.fn() };
});

import { handleScheduled } from "../src/index";
import {
  getConfig,
  getPrayerCache,
  setPrayerCache,
  markPrayerSent,
  getLastSession,
  getPeriodStats,
  calculateStreak,
  getTodayInTimezone,
  cleanOldCache,
  getKahfStats,
  setConfig,
} from "../src/services/db";
import { fetchPrayerTimes, getDueReminders, getNowInTimezone, isReminderTime } from "../src/services/prayer";
import { formatReminder, formatKahfReminder } from "../src/services/format";

describe("handleScheduled", () => {
  const db = {} as D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
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
    vi.mocked(getConfig).mockImplementation(async (_, key) => {
      if (key === "chat_id") return "123";
      if (key === "timezone") return "America/Cancun";
      if (key === "city") return "Playa del Carmen";
      if (key === "country") return "MX";
      return null;
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
      fetched_at: "2026-03-14",
    });
    vi.mocked(getNowInTimezone).mockReturnValue("14:00");
    vi.mocked(getDueReminders).mockReturnValue([]);

    await handleScheduled(db, "TOKEN");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("envoie un rappel et marque la priere", async () => {
    vi.mocked(getConfig).mockImplementation(async (_, key) => {
      if (key === "chat_id") return "123";
      if (key === "timezone") return "America/Cancun";
      if (key === "city") return "PDC";
      if (key === "country") return "MX";
      return null;
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
    });
    vi.mocked(getPeriodStats).mockResolvedValue({ ok: true, value: { sessions: 3, ayahs: 45, seconds: 2000 } });
    vi.mocked(calculateStreak).mockResolvedValue({ currentStreak: 5, bestStreak: 10 });
    vi.mocked(formatReminder).mockReturnValue("Rappel test");

    await handleScheduled(db, "TOKEN");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botTOKEN/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chat_id: "123", text: "Rappel test" }),
      }),
    );
    expect(markPrayerSent).toHaveBeenCalledWith(db, "2026-03-14", "dhuhr");
  });

  it("fetch Aladhan si cache absent", async () => {
    vi.mocked(getConfig).mockImplementation(async (_, key) => {
      if (key === "chat_id") return "123";
      if (key === "timezone") return "America/Cancun";
      if (key === "city") return "PDC";
      if (key === "country") return "MX";
      return null;
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

    expect(fetchPrayerTimes).toHaveBeenCalledWith("2026-03-14", "PDC", "MX");
    expect(setPrayerCache).toHaveBeenCalled();
    // cleanOldCache is called every run, not just on cache miss
    expect(cleanOldCache).toHaveBeenCalledWith(db, "2026-03-14");
  });

  it("ne marque pas la priere si Telegram echoue", async () => {
    vi.mocked(getConfig).mockImplementation(async (_, key) => {
      if (key === "chat_id") return "123";
      if (key === "timezone") return "America/Cancun";
      if (key === "city") return "PDC";
      if (key === "country") return "MX";
      return null;
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
      fetched_at: "2026-03-14",
    });
    vi.mocked(getNowInTimezone).mockReturnValue("12:12");
    vi.mocked(getDueReminders).mockReturnValue(["dhuhr"]);
    vi.mocked(getLastSession).mockResolvedValue(null);
    vi.mocked(getPeriodStats).mockResolvedValue({ ok: true, value: { sessions: 0, ayahs: 0, seconds: 0 } });
    vi.mocked(calculateStreak).mockResolvedValue({ currentStreak: 0, bestStreak: 0 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await handleScheduled(db, "TOKEN");

    expect(markPrayerSent).not.toHaveBeenCalled();
  });

  it("envoie message fallback si aucune session", async () => {
    vi.mocked(getConfig).mockImplementation(async (_, key) => {
      if (key === "chat_id") return "123";
      return null;
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
      fetched_at: "2026-03-14",
    });
    vi.mocked(getNowInTimezone).mockReturnValue("12:12");
    vi.mocked(getDueReminders).mockReturnValue(["dhuhr"]);
    vi.mocked(getLastSession).mockResolvedValue(null);
    vi.mocked(getPeriodStats).mockResolvedValue({ ok: true, value: { sessions: 0, ayahs: 0, seconds: 0 } });
    vi.mocked(calculateStreak).mockResolvedValue({ currentStreak: 0, bestStreak: 0 });

    await handleScheduled(db, "TOKEN");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botTOKEN/sendMessage",
      expect.objectContaining({
        body: expect.stringContaining("Aucune session"),
      }),
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

      vi.mocked(getConfig).mockImplementation(async (_, key) => {
        if (key === "chat_id") return "123";
        if (key === "timezone") return "America/Cancun";
        if (key === "city") return "PDC";
        if (key === "country") return "MX";
        if (key === "kahf_reminder_last") return null;
        return null;
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
      vi.mocked(isReminderTime).mockReturnValue(true);
      vi.mocked(getKahfStats).mockResolvedValue({ lastDuration: null, lastDate: null });
      vi.mocked(formatKahfReminder).mockReturnValue("Rappel Al-Kahf");

      await handleScheduled(db, "TOKEN");

      expect(formatKahfReminder).toHaveBeenCalledWith({
        lastDate: undefined,
        lastDuration: undefined,
      });
      expect(fetch).toHaveBeenCalledWith(
        "https://api.telegram.org/botTOKEN/sendMessage",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ chat_id: "123", text: "Rappel Al-Kahf" }),
        }),
      );
      expect(setConfig).toHaveBeenCalledWith(db, "kahf_reminder_last", "2026-03-13");
    });

    it("pas de rappel Al-Kahf en dehors du vendredi", async () => {
      // 2026-03-11 is a Wednesday
      vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));

      vi.mocked(getConfig).mockImplementation(async (_, key) => {
        if (key === "chat_id") return "123";
        if (key === "timezone") return "America/Cancun";
        if (key === "city") return "PDC";
        if (key === "country") return "MX";
        return null;
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

      vi.mocked(getConfig).mockImplementation(async (_, key) => {
        if (key === "chat_id") return "123";
        if (key === "timezone") return "America/Cancun";
        if (key === "city") return "PDC";
        if (key === "country") return "MX";
        if (key === "kahf_reminder_last") return "2026-03-13";
        return null;
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

      vi.mocked(getConfig).mockImplementation(async (_, key) => {
        if (key === "chat_id") return "123";
        if (key === "timezone") return "America/Cancun";
        if (key === "city") return "PDC";
        if (key === "country") return "MX";
        if (key === "kahf_reminder_last") return null;
        return null;
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
      vi.mocked(isReminderTime).mockReturnValue(true);
      vi.mocked(getKahfStats).mockResolvedValue({ lastDuration: 1500, lastDate: "2026-03-07" });
      vi.mocked(formatKahfReminder).mockReturnValue("Rappel Al-Kahf avec stats");

      await handleScheduled(db, "TOKEN");

      expect(formatKahfReminder).toHaveBeenCalledWith({
        lastDate: "2026-03-07",
        lastDuration: 1500,
      });
    });
  });
});
