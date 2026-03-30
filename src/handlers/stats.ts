// src/handlers/stats.ts
import type { CustomContext } from "../bot";
import { getNextPage, TOTAL_PAGES } from "../data/pages";
import { TOTAL_AYAH_COUNT } from "../data/surahs";
import {
  calculateStreak,
  getBestSpeedSession,
  getGlobalStats,
  getHistory,
  getKhatmaCount,
  getLastSession,
  getLongestSession,
  getPeriodStats,
  getPreviousWeekStats,
  getRecentPace,
  getSpeedAverages,
  getSpeedByType,
  getTimezone,
  getTodayInTimezone,
  type SessionType,
} from "../services/db";
import {
  formatError,
  formatEstimation,
  formatHistoryLine,
  formatProgress,
  formatSpeedReport,
  formatStats,
} from "../services/format";

export async function statsHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const tz = await getTimezone(ctx.db);

  const [globalResult, weekResult, monthResult, streak, prevWeekResult] =
    await Promise.all([
      getGlobalStats(ctx.db),
      getPeriodStats(ctx.db, "week", tz),
      getPeriodStats(ctx.db, "month", tz),
      calculateStreak(ctx.db, tz),
      getPreviousWeekStats(ctx.db, tz),
    ]);

  if (!globalResult.ok) {
    await ctx.reply(formatError(globalResult.error, t));
    return;
  }
  if (!weekResult.ok) {
    await ctx.reply(formatError(weekResult.error, t));
    return;
  }
  if (!monthResult.ok) {
    await ctx.reply(formatError(monthResult.error, t));
    return;
  }

  const msg = formatStats(
    {
      totalAyahs: globalResult.value.totalAyahs,
      totalSeconds: globalResult.value.totalSeconds,
      currentStreak: streak.currentStreak,
      bestStreak: streak.bestStreak,
      weekAyahs: weekResult.value.ayahs,
      weekSeconds: weekResult.value.seconds,
      monthAyahs: monthResult.value.ayahs,
      monthSeconds: monthResult.value.seconds,
      ...(prevWeekResult.ok && {
        prevWeekAyahs: prevWeekResult.value.ayahs,
        prevWeekSeconds: prevWeekResult.value.seconds,
      }),
    },
    t
  );

  await ctx.reply(msg);
}

export async function progressHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const [globalResult, lastSession, tz, khatmaCount] = await Promise.all([
    getGlobalStats(ctx.db),
    getLastSession(ctx.db, "normal"),
    getTimezone(ctx.db),
    getKhatmaCount(ctx.db),
  ]);

  if (!lastSession) {
    await ctx.reply(t.stats.noSession);
    return;
  }

  if (!globalResult.ok) {
    await ctx.reply(formatError(globalResult.error, t));
    return;
  }

  const nextPage =
    lastSession.pageEnd == null ? null : getNextPage(lastSession.pageEnd);

  let msg = formatProgress(
    {
      totalAyahsRead: globalResult.value.totalAyahs,
      totalAyahs: TOTAL_AYAH_COUNT,
      nextPage,
      khatmaCount,
    },
    t
  );

  if (lastSession.pageEnd != null) {
    msg += `\n${t.progress.page} : ${lastSession.pageEnd} / ${TOTAL_PAGES}`;

    if (lastSession.pageEnd < TOTAL_PAGES) {
      const today = getTodayInTimezone(tz);
      const pace = await getRecentPace(ctx.db, tz);
      const pagesRemaining = TOTAL_PAGES - lastSession.pageEnd;
      msg += `\n${formatEstimation(pace, pagesRemaining, today, t)}`;
    }
  }

  await ctx.reply(msg);
}

export async function speedHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const tz = await getTimezone(ctx.db);
  const [averages, bestSession, longestSession, byType] = await Promise.all([
    getSpeedAverages(ctx.db, tz),
    getBestSpeedSession(ctx.db),
    getLongestSession(ctx.db),
    getSpeedByType(ctx.db),
  ]);

  if (averages.global === null) {
    await ctx.reply(t.stats.noSession);
    return;
  }

  await ctx.reply(
    formatSpeedReport({ averages, bestSession, longestSession, byType }, t)
  );
}

export async function historyHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim().toLowerCase();
  const validTypes: Record<string, SessionType> = {
    normal: "normal",
    extra: "extra",
    kahf: "kahf",
  };
  const typeFilter = validTypes[input];

  const sessions = await getHistory(ctx.db, 10, typeFilter);

  if (sessions.length === 0) {
    await ctx.reply(t.stats.noSession);
    return;
  }

  const lines = sessions.map((s) => formatHistoryLine(s, t));
  await ctx.reply(lines.join("\n"));
}
