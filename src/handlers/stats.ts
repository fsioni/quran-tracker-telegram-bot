// src/handlers/stats.ts
import { InlineKeyboard } from "grammy";
import type { CustomContext } from "../bot";
import { getNextPage, TOTAL_PAGES } from "../data/pages";
import { TOTAL_AYAH_COUNT } from "../data/surahs";
import type { Locale } from "../locales/types";
import {
  addDays,
  getTimezone,
  getTodayInTimezone,
} from "../services/db/date-helpers";
import { getKhatmaCount, getKhatmaElapsedSeconds } from "../services/db/khatma";
import {
  getHistory,
  getLastSession,
  getSessionCount,
} from "../services/db/sessions";
import {
  getBestSpeedSession,
  getLongestSession,
  getSpeedAverages,
  getSpeedByType,
} from "../services/db/speed";
import {
  calculateStreak,
  getGlobalStats,
  getPeriodStats,
  getPreviousWeekStats,
  getRecentPageStats,
} from "../services/db/stats";
import type { SessionType } from "../services/db/types";
import {
  formatDuration,
  formatError,
  formatHistoryLine,
  formatProgress,
  formatSpeedReport,
  formatStats,
} from "../services/format";

export const HISTORY_PAGE_SIZE = 10;
export const CALLBACK_HISTORY_RE = /^hist:([1-9]\d*)(?::(\w+))?$/;

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
      totalPageSeconds: globalResult.value.totalPageSeconds,
      totalPages: globalResult.value.totalPages,
      totalSeconds: globalResult.value.totalSeconds,
      currentStreak: streak.currentStreak,
      bestStreak: streak.bestStreak,
      weekAyahs: weekResult.value.ayahs,
      weekPageSeconds: weekResult.value.pageSeconds,
      weekPages: weekResult.value.pages,
      weekSeconds: weekResult.value.seconds,
      monthAyahs: monthResult.value.ayahs,
      monthPageSeconds: monthResult.value.pageSeconds,
      monthPages: monthResult.value.pages,
      monthSeconds: monthResult.value.seconds,
      ...(prevWeekResult.ok && {
        prevWeekPageSeconds: prevWeekResult.value.pageSeconds,
        prevWeekPages: prevWeekResult.value.pages,
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
    const elapsedSeconds = await getKhatmaElapsedSeconds(ctx.db);
    msg += `\n${t.progress.page} : ${lastSession.pageEnd} / ${TOTAL_PAGES}`;
    msg += `\n${t.progress.khatmaTime(formatDuration(elapsedSeconds, t))}`;

    if (lastSession.pageEnd < TOTAL_PAGES) {
      const pagesRemaining = TOTAL_PAGES - lastSession.pageEnd;
      const recentStats = await getRecentPageStats(ctx.db, tz, 7);

      if (recentStats) {
        const remainingSeconds = Math.ceil(
          pagesRemaining * recentStats.secondsPerPage
        );
        msg += `\n${t.progress.remainingTime(formatDuration(remainingSeconds, t))}`;

        const today = getTodayInTimezone(tz);
        const daysRemaining = Math.ceil(
          pagesRemaining / recentStats.pagesPerDay
        );
        const target = addDays(today, daysRemaining);
        const d = new Date(`${target}T00:00:00Z`);
        msg += `\n${t.progress.completionDate(d.getUTCDate(), t.months[d.getUTCMonth()], d.getUTCFullYear())}`;
      } else {
        msg += `\n${t.progress.noRecentData}`;
      }
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

const VALID_SESSION_TYPES = new Set<string>(["normal", "extra", "kahf"]);

function parseTypeFilter(input: string): SessionType | undefined {
  return VALID_SESSION_TYPES.has(input) ? (input as SessionType) : undefined;
}

export async function buildHistoryMessage(
  db: D1Database,
  page: number,
  typeFilter: SessionType | undefined,
  t: Locale
): Promise<{ text: string; keyboard: InlineKeyboard | undefined }> {
  const clampedPage = Math.max(1, page);
  const count = await getSessionCount(db, typeFilter);

  if (count === 0) {
    return { text: t.stats.noSession, keyboard: undefined };
  }

  const totalPages = Math.ceil(count / HISTORY_PAGE_SIZE);
  const safePage = Math.min(clampedPage, totalPages);
  const offset = (safePage - 1) * HISTORY_PAGE_SIZE;
  const sessions = await getHistory(db, HISTORY_PAGE_SIZE, typeFilter, offset);
  const lines = sessions.map((s) => formatHistoryLine(s, t));

  if (totalPages > 1) {
    lines.push(t.history.pageIndicator(safePage, totalPages));
  }

  const text = lines.join("\n");

  let keyboard: InlineKeyboard | undefined;
  if (totalPages > 1) {
    keyboard = new InlineKeyboard();
    const typeSuffix = typeFilter ? `:${typeFilter}` : "";
    if (safePage > 1) {
      keyboard.text(t.history.prev, `hist:${safePage - 1}${typeSuffix}`);
    }
    if (safePage < totalPages) {
      keyboard.text(t.history.next, `hist:${safePage + 1}${typeSuffix}`);
    }
  }

  return { text, keyboard };
}

export async function historyHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim().toLowerCase();
  const typeFilter = parseTypeFilter(input);

  const { text, keyboard } = await buildHistoryMessage(
    ctx.db,
    1,
    typeFilter,
    t
  );
  await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined);
}

export async function historyPageCallback(ctx: CustomContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) {
    await ctx.answerCallbackQuery();
    return;
  }

  const match = CALLBACK_HISTORY_RE.exec(data);
  if (!match) {
    await ctx.answerCallbackQuery();
    return;
  }

  const page = Number.parseInt(match[1], 10);
  const typeFilter = parseTypeFilter(match[2] ?? "");
  const t = ctx.locale;

  const { text, keyboard } = await buildHistoryMessage(
    ctx.db,
    page,
    typeFilter,
    t
  );
  await ctx.editMessageText(
    text,
    keyboard ? { reply_markup: keyboard } : undefined
  );
  await ctx.answerCallbackQuery();
}
