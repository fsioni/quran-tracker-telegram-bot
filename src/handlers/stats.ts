// src/handlers/stats.ts
import type { CustomContext } from "../bot";
import {
  getHistory,
  getGlobalStats,
  getLastSession,
  getPeriodStats,
  calculateStreak,
  getConfig,
} from "../services/db";
import { formatHistoryLine, formatStats, formatProgress } from "../services/format";
import { TOTAL_AYAH_COUNT } from "../data/surahs";

const DEFAULT_TZ = "America/Cancun";
const MSG_NO_SESSION = "Aucune session enregistree.";

export async function statsHandler(ctx: CustomContext): Promise<void> {
  const tz = (await getConfig(ctx.db, "timezone")) ?? DEFAULT_TZ;

  const [global, week, month, streak] = await Promise.all([
    getGlobalStats(ctx.db),
    getPeriodStats(ctx.db, "week", tz),
    getPeriodStats(ctx.db, "month", tz),
    calculateStreak(ctx.db, tz),
  ]);

  const msg = formatStats({
    totalAyahs: global.totalAyahs,
    totalSeconds: global.totalSeconds,
    currentStreak: streak.currentStreak,
    bestStreak: streak.bestStreak,
    weekAyahs: week.ayahs,
    weekSeconds: week.seconds,
    monthAyahs: month.ayahs,
    monthSeconds: month.seconds,
  });

  await ctx.reply(msg);
}

export async function progressHandler(ctx: CustomContext): Promise<void> {
  const [global, lastSession] = await Promise.all([
    getGlobalStats(ctx.db),
    getLastSession(ctx.db),
  ]);

  if (!lastSession) {
    await ctx.reply(MSG_NO_SESSION);
    return;
  }

  const msg = formatProgress({
    totalAyahsRead: global.totalAyahs,
    totalAyahs: TOTAL_AYAH_COUNT,
    lastSurah: lastSession.surahEnd,
    lastAyah: lastSession.ayahEnd,
  });

  await ctx.reply(msg);
}

export async function historyHandler(ctx: CustomContext): Promise<void> {
  const sessions = await getHistory(ctx.db);

  if (sessions.length === 0) {
    await ctx.reply(MSG_NO_SESSION);
    return;
  }

  const lines = sessions.map(formatHistoryLine);
  await ctx.reply(lines.join("\n"));
}
