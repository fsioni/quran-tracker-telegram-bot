// src/handlers/read.ts
import { InlineKeyboard } from "grammy";
import type { CustomContext } from "../bot";
import { getNextPage, getPageRange, TOTAL_PAGES } from "../data/pages";
import { getNowTimestamp, getTimezone } from "../services/db/date-helpers";
import { getKhatmaCount, insertKhatma } from "../services/db/khatma";
import { getLastSession, insertSession } from "../services/db/sessions";
import {
  appendCompletedSurahs,
  formatError,
  formatKhatmaMessage,
  formatReadConfirmation,
  parsePageCountAndDuration,
} from "../services/format";

// Callback data for no-duration read confirmation
export const CALLBACK_READ_NODUR_CONFIRM_RE = /^ndr_c:(\d+)$/;

export async function readHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim();
  const parsed = parsePageCountAndDuration(input, t.examples.read, t);
  if (!parsed.ok) {
    await ctx.reply(formatError(parsed.error, t));
    return;
  }
  const { count, durationSeconds } = parsed.value;

  // Determine current page from last normal session
  const lastSession = await getLastSession(ctx.db, "normal");
  const currentPage = getNextPage(lastSession?.pageEnd ?? null);

  const pageStart = currentPage;
  const pageEnd = currentPage + count - 1;

  // Validate pageEnd
  if (pageEnd > TOTAL_PAGES) {
    await ctx.reply(
      formatError(
        t.read.remainingPages(
          TOTAL_PAGES - pageStart + 1,
          pageStart,
          TOTAL_PAGES
        ),
        t
      )
    );
    return;
  }

  // Get page range data (surah/ayah info)
  const rangeData = getPageRange(pageStart, pageEnd);
  if (!rangeData) {
    await ctx.reply(formatError(t.read.pagesInvalid, t));
    return;
  }

  // No-duration: ask confirmation before inserting
  if (durationSeconds === null) {
    const msg =
      count === 1
        ? `${t.read.pageSingularRecorded(pageStart)} -- ${t.session.noDurationPrompt}`
        : `${t.read.pagePluralRecorded(pageStart, pageEnd)} -- ${t.session.noDurationPrompt}`;
    const keyboard = new InlineKeyboard()
      .text(t.manage.confirm, `ndr_c:${count}`)
      .text(t.manage.cancel, "ndr_x");
    await ctx.reply(msg, { reply_markup: keyboard });
    return;
  }

  await insertAndReply(ctx, pageStart, pageEnd, durationSeconds, rangeData);
}

async function insertAndReply(
  ctx: CustomContext,
  pageStart: number,
  pageEnd: number,
  durationSeconds: number | null,
  rangeData: {
    surahStart: number;
    ayahStart: number;
    surahEnd: number;
    ayahEnd: number;
    ayahCount: number;
  }
): Promise<void> {
  const t = ctx.locale;
  const tz = await getTimezone(ctx.db);
  const now = getNowTimestamp(tz);

  const result = await insertSession(ctx.db, {
    startedAt: now,
    durationSeconds,
    surahStart: rangeData.surahStart,
    ayahStart: rangeData.ayahStart,
    surahEnd: rangeData.surahEnd,
    ayahEnd: rangeData.ayahEnd,
    ayahCount: rangeData.ayahCount,
    type: "normal",
    pageStart,
    pageEnd,
  });
  if (!result.ok) {
    await ctx.reply(formatError(result.error, t));
    return;
  }
  const session = result.value;

  const parts: string[] = [];

  // Check for khatma (reached last page)
  if (pageEnd === TOTAL_PAGES) {
    await insertKhatma(ctx.db, now);
    const khatmaCount = await getKhatmaCount(ctx.db);
    parts.push(formatKhatmaMessage(khatmaCount, t));
  } else {
    parts.push(
      formatReadConfirmation(
        {
          pageStart: session.pageStart ?? pageStart,
          pageEnd: session.pageEnd ?? pageEnd,
          durationSeconds: session.durationSeconds,
          totalPagesRead: session.pageEnd ?? pageEnd,
          totalPages: TOTAL_PAGES,
        },
        t
      )
    );
  }

  // Check for completed surahs
  appendCompletedSurahs(
    parts,
    rangeData.surahStart,
    rangeData.ayahStart,
    rangeData.surahEnd,
    rangeData.ayahEnd,
    t
  );

  await ctx.reply(parts.join("\n"));
}

export async function confirmReadNoDurCallback(
  ctx: CustomContext
): Promise<void> {
  const t = ctx.locale;
  const data = ctx.callbackQuery?.data;
  const match = data?.match(CALLBACK_READ_NODUR_CONFIRM_RE);
  if (!match) {
    await ctx.answerCallbackQuery();
    return;
  }

  const count = Number.parseInt(match[1], 10);

  // Re-derive page range from current state
  const lastSession = await getLastSession(ctx.db, "normal");
  const currentPage = getNextPage(lastSession?.pageEnd ?? null);
  const pageStart = currentPage;
  const pageEnd = currentPage + count - 1;

  if (pageEnd > TOTAL_PAGES) {
    await ctx.editMessageText(
      formatError(
        t.read.remainingPages(
          TOTAL_PAGES - pageStart + 1,
          pageStart,
          TOTAL_PAGES
        ),
        t
      )
    );
    await ctx.answerCallbackQuery();
    return;
  }

  const rangeData = getPageRange(pageStart, pageEnd);
  if (!rangeData) {
    await ctx.editMessageText(formatError(t.read.pagesInvalid, t));
    await ctx.answerCallbackQuery();
    return;
  }

  await insertAndReply(ctx, pageStart, pageEnd, null, rangeData);
  await ctx.answerCallbackQuery();
}
