// src/handlers/kahf.ts
import type { CustomContext } from "../bot";
import {
  effectivePageCount,
  getNextKahfPage,
  getPageRange,
  KAHF_PAGE_END,
  KAHF_TOTAL_PAGES,
} from "../data/pages";
import { getNowTimestamp, getTimezone } from "../services/db/date-helpers";
import {
  calculateKahfPagesRead,
  getKahfSessionsThisWeek,
  getLastWeekKahfTotal,
} from "../services/db/kahf";
import { insertSession } from "../services/db/sessions";
import { get7DayTypeAvgSpeed } from "../services/db/speed";
import {
  formatError,
  formatKahfPageConfirmation,
  formatSpeedComparison,
  insertAfterFirstLine,
  parsePageCountAndDuration,
} from "../services/format";

export async function kahfHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim();
  const parsed = parsePageCountAndDuration(input, t.examples.kahf, t);
  if (!parsed.ok) {
    await ctx.reply(formatError(parsed.error, t));
    return;
  }
  const { count, durationSeconds } = parsed.value;

  const tz = await getTimezone(ctx.db);

  // Get kahf sessions this week
  const weekSessions = await getKahfSessionsThisWeek(ctx.db, tz);

  // Calculate pages already read this week
  const pagesAlreadyRead = calculateKahfPagesRead(weekSessions);

  // Check if already finished Al-Kahf this week
  const pageStart = getNextKahfPage(pagesAlreadyRead);
  if (pageStart === undefined) {
    await ctx.reply(t.kahf.alreadyComplete);
    return;
  }
  const pageEnd = pageStart + count - 1;

  // Check if pageEnd exceeds Al-Kahf
  if (pageEnd > KAHF_PAGE_END) {
    const remaining = KAHF_TOTAL_PAGES - pagesAlreadyRead;
    await ctx.reply(
      formatError(t.kahf.remainingPages(remaining, pageStart, KAHF_PAGE_END), t)
    );
    return;
  }

  // Get page range data (surah/ayah info)
  const rangeData = getPageRange(pageStart, pageEnd, "kahf");
  if (!rangeData) {
    await ctx.reply(formatError(t.read.pagesInvalid, t));
    return;
  }

  const now = getNowTimestamp(tz);

  // Insert session with type 'kahf'
  const result = await insertSession(ctx.db, {
    startedAt: now,
    durationSeconds,
    surahStart: rangeData.surahStart,
    ayahStart: rangeData.ayahStart,
    surahEnd: rangeData.surahEnd,
    ayahEnd: rangeData.ayahEnd,
    ayahCount: rangeData.ayahCount,
    type: "kahf",
    pageStart,
    pageEnd,
  });
  if (!result.ok) {
    await ctx.reply(formatError(result.error, t));
    return;
  }

  // Calculate week totals including this session
  const weekPagesRead = pagesAlreadyRead + count;
  const weekTotalSeconds =
    weekSessions.reduce((sum, s) => sum + s.durationSeconds, 0) +
    durationSeconds;

  const isComplete = weekPagesRead >= KAHF_TOTAL_PAGES;
  const sessionPages = effectivePageCount(pageStart, pageEnd, "kahf");

  let comparison = "";
  if (durationSeconds > 0) {
    const avg = await get7DayTypeAvgSpeed(ctx.db, "kahf", tz, result.value.id);
    const currentSpeed = sessionPages / (durationSeconds / 3600);
    comparison = formatSpeedComparison(currentSpeed, avg.pagesPerHour, t);
  }

  if (isComplete) {
    const lastWeekResult = await getLastWeekKahfTotal(ctx.db, tz);
    if (!lastWeekResult.ok) {
      console.error("getLastWeekKahfTotal failed:", lastWeekResult.error);
    }
    const lastWeekTotalSeconds = lastWeekResult.ok ? lastWeekResult.value : 0;

    await ctx.reply(
      insertAfterFirstLine(
        formatKahfPageConfirmation(
          {
            kahfPage: weekPagesRead,
            kahfTotal: KAHF_TOTAL_PAGES,
            durationSeconds,
            weekPagesRead,
            weekTotalSeconds,
            isComplete: true,
            lastWeekTotalSeconds:
              lastWeekTotalSeconds > 0 ? lastWeekTotalSeconds : undefined,
            sessionPages,
          },
          t
        ),
        comparison
      )
    );
  } else {
    await ctx.reply(
      insertAfterFirstLine(
        formatKahfPageConfirmation(
          {
            kahfPage: weekPagesRead,
            kahfTotal: KAHF_TOTAL_PAGES,
            durationSeconds,
            weekPagesRead,
            weekTotalSeconds,
            isComplete: false,
            sessionPages,
          },
          t
        ),
        comparison
      )
    );
  }
}
