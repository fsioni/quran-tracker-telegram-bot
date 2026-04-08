import { Bot, webhookCallback } from "grammy";
import { createBot } from "./bot";
import {
  DEFAULT_CITY,
  DEFAULT_COUNTRY,
  DEFAULT_TZ,
  WEEKLY_RECAP_HOUR,
} from "./config";
import { getNextKahfPage, getNextPage } from "./data/pages";
import { CALLBACK_TIMER_GO } from "./handlers/timer";
import { getBotCommands, getLocale } from "./locales";
import type { Locale } from "./locales/types";
import { getConfig, setConfig } from "./services/db/config";
import { getTodayInTimezone } from "./services/db/date-helpers";
import {
  calculateKahfPagesRead,
  getKahfSessionsThisWeek,
  getKahfStats,
} from "./services/db/kahf";
import {
  cleanOldCache,
  getPrayerCache,
  markPrayerSent,
  markStreakFollowupSent,
  setPrayerCache,
} from "./services/db/prayer";
import { getLastSession, hasSessionToday } from "./services/db/sessions";
import { calculateStreak, getPeriodStats } from "./services/db/stats";
import type { PrayerCacheRow } from "./services/db/types";
import {
  formatKahfReminder,
  formatReminder,
  formatStreakFollowup,
  formatWeeklyRecap,
} from "./services/format";
import {
  addMinutesToHHMM,
  fetchPrayerTimes,
  getDueReminders,
  getNowInTimezone,
  isReminderDue,
} from "./services/prayer";
import { buildWeeklyRecap } from "./services/weekly-recap";

export interface Env {
  ALLOWED_USER_ID: string;
  BOT_TOKEN: string;
  DB: D1Database;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: { inline_keyboard: { text: string; callback_data: string }[][] }
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { chat_id: chatId, text };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) {
      console.error(`Telegram sendMessage HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(
      "Telegram sendMessage failed:",
      e instanceof Error ? e.message : String(e)
    );
    return false;
  }
}

function getDayOfWeek(tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun, 5=Fri
}

interface ScheduledContext {
  botToken: string;
  chatId: string;
  db: D1Database;
  nowHHMM: string;
  t: Locale;
  today: string;
  tz: string;
}

async function computeNextKahfPage(
  db: D1Database,
  tz: string
): Promise<number | undefined> {
  const sessions = await getKahfSessionsThisWeek(db, tz);
  return getNextKahfPage(calculateKahfPagesRead(sessions));
}

async function sendPrayerReminders(
  sctx: ScheduledContext,
  cache: PrayerCacheRow,
  isFriday: boolean
): Promise<void> {
  const duePrayers = getDueReminders(cache, sctx.nowHHMM);
  if (duePrayers.length === 0) {
    return;
  }

  const [lastSession, weekStatsResult, streak] = await Promise.all([
    getLastSession(sctx.db, "normal"),
    getPeriodStats(sctx.db, "week", sctx.tz),
    calculateStreak(sctx.db, sctx.tz),
  ]);

  const weekStats = weekStatsResult.ok
    ? weekStatsResult.value
    : (() => {
        console.error("getPeriodStats failed:", weekStatsResult.error);
        return { sessions: 0, ayahs: 0, seconds: 0 };
      })();

  const isIshaIncluded = duePrayers.includes("isha");
  let streakAtRisk = false;
  if (isIshaIncluded && streak.currentStreak >= 2) {
    const readToday = await hasSessionToday(sctx.db, sctx.tz);
    streakAtRisk = !readToday;
  }

  const nextKahfPage = isFriday
    ? await computeNextKahfPage(sctx.db, sctx.tz)
    : undefined;
  const nextPage = nextKahfPage ?? getNextPage(lastSession?.pageEnd ?? null);

  const message = formatReminder(
    {
      nextPage,
      weekSessions: weekStats.sessions,
      weekAyahs: weekStats.ayahs,
      streak: streak.currentStreak,
      streakAtRisk,
    },
    sctx.t
  );

  const goKeyboard = {
    inline_keyboard: [
      [{ text: sctx.t.timer.go, callback_data: CALLBACK_TIMER_GO }],
    ],
  };
  const sent = await sendTelegramMessage(
    sctx.botToken,
    sctx.chatId,
    message,
    goKeyboard
  );
  if (sent) {
    for (const prayer of duePrayers) {
      await markPrayerSent(sctx.db, sctx.today, prayer);
    }
  }
}

async function sendKahfReminder(
  sctx: ScheduledContext,
  cache: PrayerCacheRow
): Promise<void> {
  const kahfReminderLast = await getConfig(sctx.db, "kahf_reminder_last");
  if (
    kahfReminderLast === sctx.today ||
    !isReminderDue(sctx.nowHHMM, cache.fajr)
  ) {
    return;
  }

  const [kahfStats, nextKahfPage] = await Promise.all([
    getKahfStats(sctx.db),
    computeNextKahfPage(sctx.db, sctx.tz),
  ]);
  const kahfMsg = formatKahfReminder(
    {
      lastDate: kahfStats.lastDate ?? undefined,
      lastDuration: kahfStats.lastDuration ?? undefined,
      nextKahfPage,
    },
    sctx.t
  );
  const kahfSent = await sendTelegramMessage(
    sctx.botToken,
    sctx.chatId,
    kahfMsg
  );
  if (kahfSent) {
    await setConfig(sctx.db, "kahf_reminder_last", sctx.today);
  }
}

async function sendStreakFollowup(
  sctx: ScheduledContext,
  cache: PrayerCacheRow
): Promise<void> {
  if (cache.streak_followup_sent === 1) {
    return;
  }
  if (cache.isha_sent === 0) {
    return;
  }
  if (!isReminderDue(sctx.nowHHMM, addMinutesToHHMM(cache.isha, 90))) {
    return;
  }
  const readToday = await hasSessionToday(sctx.db, sctx.tz);
  if (readToday) {
    return;
  }
  const streak = await calculateStreak(sctx.db, sctx.tz);
  if (streak.currentStreak < 2) {
    return;
  }

  const message = formatStreakFollowup(
    { streak: streak.currentStreak },
    sctx.t
  );
  const goKeyboard = {
    inline_keyboard: [
      [{ text: sctx.t.timer.go, callback_data: CALLBACK_TIMER_GO }],
    ],
  };
  const sent = await sendTelegramMessage(
    sctx.botToken,
    sctx.chatId,
    message,
    goKeyboard
  );
  if (sent) {
    await markStreakFollowupSent(sctx.db, sctx.today);
  }
}

async function sendWeeklyRecap(sctx: ScheduledContext): Promise<void> {
  const recapLast = await getConfig(sctx.db, "weekly_recap_last");
  if (recapLast === sctx.today || sctx.nowHHMM < WEEKLY_RECAP_HOUR) {
    return;
  }

  try {
    const recapResult = await buildWeeklyRecap(sctx.db, sctx.tz);
    if (!recapResult.ok) {
      console.error("buildWeeklyRecap failed:", recapResult.error);
      return;
    }
    const recapMsg = formatWeeklyRecap(recapResult.value, sctx.t);
    const recapSent = await sendTelegramMessage(
      sctx.botToken,
      sctx.chatId,
      recapMsg
    );
    if (recapSent) {
      await setConfig(sctx.db, "weekly_recap_last", sctx.today);
    }
  } catch (e) {
    console.error(
      "Weekly recap failed:",
      e instanceof Error ? e.message : String(e)
    );
  }
}

export async function handleScheduled(
  db: D1Database,
  botToken: string
): Promise<void> {
  const chatId = await getConfig(db, "chat_id");
  if (!chatId) {
    return;
  }

  const [tzRaw, cityRaw, countryRaw, langRaw] = await Promise.all([
    getConfig(db, "timezone"),
    getConfig(db, "city"),
    getConfig(db, "country"),
    getConfig(db, "language"),
  ]);
  let tz = tzRaw ?? DEFAULT_TZ;
  const city = cityRaw ?? DEFAULT_CITY;
  const country = countryRaw ?? DEFAULT_COUNTRY;
  const t = getLocale(langRaw);

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
    const result = await fetchPrayerTimes(today, city, country, t);
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
      streak_followup_sent: 0,
      fetched_at: new Date().toISOString(),
    } as PrayerCacheRow;
  }

  await cleanOldCache(db, today);

  const nowHHMM = getNowInTimezone(tz);
  const sctx: ScheduledContext = {
    db,
    botToken,
    chatId,
    today,
    nowHHMM,
    tz,
    t,
  };

  const dayOfWeek = getDayOfWeek(tz);
  const isFriday = dayOfWeek === 5;
  await sendPrayerReminders(sctx, cache, isFriday);
  await sendStreakFollowup(sctx, cache);
  if (isFriday) {
    await sendKahfReminder(sctx, cache);
  }
  if (dayOfWeek === 0) {
    await sendWeeklyRecap(sctx);
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
        const lang = await getConfig(env.DB, "language");
        const t = getLocale(lang);
        await bot.api.setMyCommands(getBotCommands(t));
        return new Response("Commands registered");
      } catch (e) {
        console.error(
          "setMyCommands failed:",
          e instanceof Error ? e.message : String(e)
        );
        return new Response("Failed to register commands", { status: 502 });
      }
    }
    const bot = createBot(env.BOT_TOKEN, env.DB, env.ALLOWED_USER_ID);
    return webhookCallback(bot, "cloudflare-mod")(request);
  },

  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(handleScheduled(env.DB, env.BOT_TOKEN));
  },
};
