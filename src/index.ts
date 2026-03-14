import { createBot } from "./bot";
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
} from "./services/db";
import { fetchPrayerTimes, getDueReminders, getNowInTimezone } from "./services/prayer";
import { formatReminder } from "./services/format";
import { DEFAULT_TZ } from "./config";

export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("Telegram sendMessage failed:", (e as Error).message);
  }
}

export async function handleScheduled(db: D1Database, botToken: string): Promise<void> {
  const chatId = await getConfig(db, "chat_id");
  if (!chatId) return;

  const tz = (await getConfig(db, "timezone")) ?? DEFAULT_TZ;
  const city = (await getConfig(db, "city")) ?? "Playa del Carmen";
  const country = (await getConfig(db, "country")) ?? "MX";
  const today = getTodayInTimezone(tz);

  let cache = await getPrayerCache(db, today);
  if (!cache) {
    const result = await fetchPrayerTimes(today, city, country);
    if (!result.ok) {
      console.error("Prayer fetch failed:", result.error);
      return;
    }
    await setPrayerCache(db, result.value);
    await cleanOldCache(db, today);
    cache = await getPrayerCache(db, today);
    if (!cache) return;
  }

  const nowHHMM = getNowInTimezone(tz);
  const duePrayers = getDueReminders(cache, nowHHMM);
  if (duePrayers.length === 0) return;

  const [lastSession, weekStats, streak] = await Promise.all([
    getLastSession(db),
    getPeriodStats(db, "week", tz),
    calculateStreak(db, tz),
  ]);

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

  await sendTelegramMessage(botToken, chatId, message);

  for (const prayer of duePrayers) {
    await markPrayerSent(db, today, prayer);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
