// src/handlers/kahf.ts
import { InlineKeyboard } from "grammy";
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

// Callback data for no-duration kahf confirmation
export const CALLBACK_KAHF_NODUR_CONFIRM_RE = /^ndk_c:(\d+)$/;

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

  // No-duration: ask confirmation before inserting
  if (durationSeconds === null) {
    const msg = `${t.kahf.pageReadNoDuration(pagesAlreadyRead + count, KAHF_TOTAL_PAGES)} -- ${t.session.noDurationPrompt}`;
    const keyboard = new InlineKeyboard()
      .text(t.manage.confirm, `ndk_c:${count}`)
      .text(t.manage.cancel, "ndk_x");
    await ctx.reply(msg, { reply_markup: keyboard });
    return;
  }

  await insertAndReplyKahf(ctx, {
    count,
    durationSeconds,
    weekSessions,
    pagesAlreadyRead,
    pageStart,
    pageEnd,
    rangeData,
    tz,
  });
}

interface InsertKahfParams {
  count: number;
  durationSeconds: number | null;
  pageEnd: number;
  pageStart: number;
  pagesAlreadyRead: number;
  rangeData: {
    surahStart: number;
    ayahStart: number;
    surahEnd: number;
    ayahEnd: number;
    ayahCount: number;
  };
  tz: string;
  weekSessions: { durationSeconds: number | null }[];
}

async function insertAndReplyKahf(
  ctx: CustomContext,
  params: InsertKahfParams
): Promise<void> {
  const {
    count,
    durationSeconds,
    weekSessions,
    pagesAlreadyRead,
    pageStart,
    pageEnd,
    rangeData,
    tz,
  } = params;
  const t = ctx.locale;
  const now = getNowTimestamp(tz);

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

  const weekPagesRead = pagesAlreadyRead + count;
  const weekTotalSeconds =
    weekSessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) +
    (durationSeconds ?? 0);

  const isComplete = weekPagesRead >= KAHF_TOTAL_PAGES;
  const sessionPages = effectivePageCount(pageStart, pageEnd, "kahf");

  let comparison = "";
  if (durationSeconds != null && durationSeconds > 0) {
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

export async function confirmKahfNoDurCallback(
  ctx: CustomContext
): Promise<void> {
  const t = ctx.locale;
  const data = ctx.callbackQuery?.data;
  const match = data?.match(CALLBACK_KAHF_NODUR_CONFIRM_RE);
  if (!match) {
    await ctx.answerCallbackQuery();
    return;
  }

  const count = Number.parseInt(match[1], 10);
  if (count < 1) {
    await ctx.answerCallbackQuery();
    return;
  }
  const tz = await getTimezone(ctx.db);

  // Re-check kahf state
  const weekSessions = await getKahfSessionsThisWeek(ctx.db, tz);
  const pagesAlreadyRead = calculateKahfPagesRead(weekSessions);
  const pageStart = getNextKahfPage(pagesAlreadyRead);
  if (pageStart === undefined) {
    await ctx.editMessageText(t.kahf.alreadyComplete);
    await ctx.answerCallbackQuery();
    return;
  }
  const pageEnd = pageStart + count - 1;
  if (pageEnd > KAHF_PAGE_END) {
    const remaining = KAHF_TOTAL_PAGES - pagesAlreadyRead;
    await ctx.editMessageText(
      formatError(t.kahf.remainingPages(remaining, pageStart, KAHF_PAGE_END), t)
    );
    await ctx.answerCallbackQuery();
    return;
  }

  const rangeData = getPageRange(pageStart, pageEnd, "kahf");
  if (!rangeData) {
    await ctx.editMessageText(formatError(t.read.pagesInvalid, t));
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  await insertAndReplyKahf(ctx, {
    count,
    durationSeconds: null,
    weekSessions,
    pagesAlreadyRead,
    pageStart,
    pageEnd,
    rangeData,
    tz,
  });
  await ctx.answerCallbackQuery();
}
