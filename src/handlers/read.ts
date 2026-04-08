// src/handlers/read.ts
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
import { getMilestoneText } from "../services/milestone";

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

  const tz = await getTimezone(ctx.db);
  const now = getNowTimestamp(tz);

  // Insert session
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

  const milestone = getMilestoneText(
    { surahEnd: rangeData.surahEnd, ayahEnd: rangeData.ayahEnd, pageEnd },
    t
  );
  if (milestone) {
    parts.push(milestone);
  }

  await ctx.reply(parts.join("\n"));
}
