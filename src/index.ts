import { createBot, BOT_COMMANDS } from "./bot";
import { Bot } from "grammy";
import { webhookCallback } from "grammy";
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
} from "./services/db";
import type { PrayerCacheRow } from "./services/db";
import { fetchPrayerTimes, getDueReminders, getNowInTimezone, isReminderDue } from "./services/prayer";
import { formatReminder, formatKahfReminder } from "./services/format";
import { DEFAULT_TZ, DEFAULT_CITY, DEFAULT_COUNTRY } from "./config";

export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!response.ok) {
      console.error(`Telegram sendMessage HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Telegram sendMessage failed:", (e as Error).message);
    return false;
  }
}

export async function handleScheduled(db: D1Database, botToken: string): Promise<void> {
  const chatId = await getConfig(db, "chat_id");
  if (!chatId) return;

  const [tzRaw, cityRaw, countryRaw] = await Promise.all([
    getConfig(db, "timezone"),
    getConfig(db, "city"),
    getConfig(db, "country"),
  ]);
  let tz = tzRaw ?? DEFAULT_TZ;
  const city = cityRaw ?? DEFAULT_CITY;
  const country = countryRaw ?? DEFAULT_COUNTRY;
  let today: string;
  try {
    today = getTodayInTimezone(tz);
  } catch {
    console.error(`Invalid timezone "${tz}", falling back to ${DEFAULT_TZ}`);
    tz = DEFAULT_TZ;
    today = getTodayInTimezone(tz);
  }

  let cache = await getPrayerCache(db, today);
  if (!cache) {
    const result = await fetchPrayerTimes(today, city, country);
    if (!result.ok) {
      console.error("Prayer fetch failed:", result.error);
      return;
    }
    await setPrayerCache(db, result.value);
    cache = {
      ...result.value,
      fajr_sent: 0,
      dhuhr_sent: 0,
      asr_sent: 0,
      maghrib_sent: 0,
      isha_sent: 0,
      fetched_at: new Date().toISOString(),
    } as PrayerCacheRow;
  }

  await cleanOldCache(db, today);

  const nowHHMM = getNowInTimezone(tz);
  const duePrayers = getDueReminders(cache, nowHHMM);

  if (duePrayers.length > 0) {
    const [lastSession, weekStatsResult, streak] = await Promise.all([
      getLastSession(db),
      getPeriodStats(db, "week", tz),
      calculateStreak(db, tz),
    ]);

    const weekStats = weekStatsResult.ok
      ? weekStatsResult.value
      : (() => {
          console.error("getPeriodStats failed:", weekStatsResult.error);
          return { sessions: 0, ayahs: 0, seconds: 0 };
        })();

    let message: string;
    if (lastSession) {
      message = formatReminder({
        lastSessionDate: lastSession.startedAt,
        lastSurahNum: lastSession.surahEnd,
        lastAyah: lastSession.ayahEnd,
        weekSessions: weekStats.sessions,
        weekAyahs: weekStats.ayahs,
        streak: streak.currentStreak,
      });
    } else {
      message = "Rappel lecture du Coran\n\nAucune session enregistree. Commence avec /session !";
    }

    const sent = await sendTelegramMessage(botToken, chatId, message);
    if (sent) {
      for (const prayer of duePrayers) {
        await markPrayerSent(db, today, prayer);
      }
    }
  }

  // Al-Kahf Friday reminder
  const nowDate = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" });
  const dayOfWeek = formatter.format(nowDate);

  if (dayOfWeek === "Friday") {
    const kahfReminderLast = await getConfig(db, "kahf_reminder_last");
    if (kahfReminderLast !== today) {
      if (isReminderDue(nowHHMM, cache.fajr)) {
        const kahfStats = await getKahfStats(db);
        const kahfMsg = formatKahfReminder({
          lastDate: kahfStats.lastDate ?? undefined,
          lastDuration: kahfStats.lastDuration ?? undefined,
        });
        const kahfSent = await sendTelegramMessage(botToken, chatId, kahfMsg);
        if (kahfSent) {
          await setConfig(db, "kahf_reminder_last", today);
        }
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/setup") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      if (request.headers.get("Authorization") !== `Bearer ${env.BOT_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const bot = new Bot(env.BOT_TOKEN);
        await bot.api.setMyCommands(BOT_COMMANDS);
        return new Response("Commands registered");
      } catch (e) {
        console.error("setMyCommands failed:", (e as Error).message);
        return new Response("Failed to register commands", { status: 502 });
      }
    }
    const bot = createBot(env.BOT_TOKEN, env.DB);
    return webhookCallback(bot, "cloudflare-mod")(request);
  },

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(handleScheduled(env.DB, env.BOT_TOKEN));
  },
};
