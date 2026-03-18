// src/handlers/stats.ts
import type { CustomContext } from "../bot";
import {
  getHistory,
  getGlobalStats,
  getLastSession,
  getPeriodStats,
  calculateStreak,
  getTimezone,
  getRecentPace,
  getTodayInTimezone,
  getKhatmaCount,
  getSpeedAverages,
  getBestSpeedSession,
  getLongestSession,
  getSpeedByType,
  type SessionType,
} from "../services/db";
import { formatHistoryLine, formatStats, formatProgress, formatEstimation, formatError, formatSpeedReport } from "../services/format";
import { TOTAL_AYAH_COUNT } from "../data/surahs";
import { TOTAL_PAGES } from "../data/pages";
const MSG_NO_SESSION = "Aucune session enregistree.";

export async function statsHandler(ctx: CustomContext): Promise<void> {
  const tz = await getTimezone(ctx.db);

  const [globalResult, weekResult, monthResult, streak] = await Promise.all([
    getGlobalStats(ctx.db),
    getPeriodStats(ctx.db, "week", tz),
    getPeriodStats(ctx.db, "month", tz),
    calculateStreak(ctx.db, tz),
  ]);

  if (!globalResult.ok) { await ctx.reply(formatError(globalResult.error)); return; }
  if (!weekResult.ok) { await ctx.reply(formatError(weekResult.error)); return; }
  if (!monthResult.ok) { await ctx.reply(formatError(monthResult.error)); return; }

  const msg = formatStats({
    totalAyahs: globalResult.value.totalAyahs,
    totalSeconds: globalResult.value.totalSeconds,
    currentStreak: streak.currentStreak,
    bestStreak: streak.bestStreak,
    weekAyahs: weekResult.value.ayahs,
    weekSeconds: weekResult.value.seconds,
    monthAyahs: monthResult.value.ayahs,
    monthSeconds: monthResult.value.seconds,
  });

  await ctx.reply(msg);
}

export async function progressHandler(ctx: CustomContext): Promise<void> {
  const [globalResult, lastSession, tz, khatmaCount] = await Promise.all([
    getGlobalStats(ctx.db),
    getLastSession(ctx.db, 'normal'),
    getTimezone(ctx.db),
    getKhatmaCount(ctx.db),
  ]);

  if (!lastSession) {
    await ctx.reply(MSG_NO_SESSION);
    return;
  }

  if (!globalResult.ok) {
    await ctx.reply(formatError(globalResult.error));
    return;
  }

  let msg = formatProgress({
    totalAyahsRead: globalResult.value.totalAyahs,
    totalAyahs: TOTAL_AYAH_COUNT,
    lastSurah: lastSession.surahEnd,
    lastAyah: lastSession.ayahEnd,
    khatmaCount,
  });

  if (lastSession.pageEnd != null) {
    msg += `\nPage : ${lastSession.pageEnd} / ${TOTAL_PAGES}`;

    if (lastSession.pageEnd < TOTAL_PAGES) {
      const today = getTodayInTimezone(tz);
      const pace = await getRecentPace(ctx.db, tz);
      const pagesRemaining = TOTAL_PAGES - lastSession.pageEnd;
      msg += `\n${formatEstimation(pace, pagesRemaining, today)}`;
    }
  }

  await ctx.reply(msg);
}

export async function speedHandler(ctx: CustomContext): Promise<void> {
  const tz = await getTimezone(ctx.db);
  const [averages, bestSession, longestSession, byType] = await Promise.all([
    getSpeedAverages(ctx.db, tz),
    getBestSpeedSession(ctx.db),
    getLongestSession(ctx.db),
    getSpeedByType(ctx.db),
  ]);

  if (averages.global === null) {
    await ctx.reply("Aucune session enregistree.");
    return;
  }

  await ctx.reply(formatSpeedReport({ averages, bestSession, longestSession, byType }));
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
