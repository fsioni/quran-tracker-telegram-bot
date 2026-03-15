// src/handlers/stats.ts
import type { CustomContext } from "../bot";
import {
  getHistory,
  getGlobalStats,
  getLastSession,
  getPeriodStats,
  calculateStreak,
  getConfig,
  type SessionType,
} from "../services/db";
import { formatHistoryLine, formatStats, formatProgress } from "../services/format";
import { TOTAL_AYAH_COUNT } from "../data/surahs";
import { TOTAL_PAGES } from "../data/pages";
import { DEFAULT_TZ } from "../config";
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
    getLastSession(ctx.db, 'normal'),
  ]);

  if (!lastSession) {
    await ctx.reply(MSG_NO_SESSION);
    return;
  }

  let msg = formatProgress({
    totalAyahsRead: global.totalAyahs,
    totalAyahs: TOTAL_AYAH_COUNT,
    lastSurah: lastSession.surahEnd,
    lastAyah: lastSession.ayahEnd,
  });

  if (lastSession.pageEnd != null) {
    msg += `\nPage : ${lastSession.pageEnd} / ${TOTAL_PAGES}`;
  }

  await ctx.reply(msg);
}

export async function historyHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim().toLowerCase();
  const validTypes: Record<string, SessionType> = { normal: 'normal', extra: 'extra', kahf: 'kahf' };
  const typeFilter = validTypes[input];

  const sessions = await getHistory(ctx.db, 10, typeFilter);

  if (sessions.length === 0) {
    await ctx.reply(MSG_NO_SESSION);
    return;
  }

  const lines = sessions.map((s) => formatHistoryLine(s));
  await ctx.reply(lines.join("\n"));
}
