// src/handlers/extra.ts
import type { CustomContext } from "../bot";
import { effectivePageCount, getPageRange } from "../data/pages";
import { getNowTimestamp, getTimezone } from "../services/db/date-helpers";
import { insertSession } from "../services/db/sessions";
import { get7DayTypeAvgSpeed } from "../services/db/speed";
import {
  appendCompletedSurahs,
  formatError,
  formatSessionConfirmation,
  formatSpeedComparison,
  parseDuration,
  parsePage,
  parseRange,
} from "../services/format";
import { calculateAyahCount, validateRange } from "../services/quran";

const WHITESPACE_RE = /\s+/;
const PAGE_OR_RANGE_RE = /^\d+(-\d+)?$/;

async function appendSpeedComparison(
  msgParts: string[],
  ctx: CustomContext,
  tz: string,
  sessionId: number,
  durationSeconds: number,
  pageStart: number | undefined,
  pageEnd: number | undefined,
  ayahCount: number
): Promise<void> {
  if (durationSeconds <= 0) {
    return;
  }
  const avg = await get7DayTypeAvgSpeed(ctx.db, "extra", tz, sessionId);
  const isPageBased = pageStart != null && pageEnd != null;
  const currentSpeed = isPageBased
    ? effectivePageCount(pageStart, pageEnd, "extra") / (durationSeconds / 3600)
    : ayahCount / (durationSeconds / 3600);
  const avgSpeed = isPageBased ? avg.pagesPerHour : avg.versesPerHour;
  const comparison = formatSpeedComparison(currentSpeed, avgSpeed, ctx.locale);
  if (comparison) {
    msgParts.push(comparison);
  }
}

export async function extraHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim();
  const parts = input.split(WHITESPACE_RE);

  if (parts.length < 2 || !parts[0]) {
    await ctx.reply(formatError(t.read.formatInvalid, t, t.examples.extra));
    return;
  }

  const [targetStr, durationStr] = parts;

  // Parse duration first to fail fast
  const durationResult = parseDuration(durationStr, t);
  if (!durationResult.ok) {
    await ctx.reply(formatError(durationResult.error, t));
    return;
  }

  let surahStart: number;
  let ayahStart: number;
  let surahEnd: number;
  let ayahEnd: number;
  let ayahCount: number;
  let pageStart: number | undefined;
  let pageEnd: number | undefined;

  // Try page-based first, then verse-based
  const pageResult = parsePage(targetStr, t);
  if (pageResult.ok) {
    pageStart = pageResult.value.pageStart;
    pageEnd = pageResult.value.pageEnd;

    const rangeData = getPageRange(pageStart, pageEnd);
    if (!rangeData) {
      await ctx.reply(formatError(t.read.pagesInvalid, t));
      return;
    }

    surahStart = rangeData.surahStart;
    ayahStart = rangeData.ayahStart;
    surahEnd = rangeData.surahEnd;
    ayahEnd = rangeData.ayahEnd;
    ayahCount = rangeData.ayahCount;
  } else if (PAGE_OR_RANGE_RE.test(targetStr)) {
    // Looks like a page number/range but parsePage rejected it (e.g. 0, 605)
    await ctx.reply(formatError(pageResult.error, t));
    return;
  } else {
    const rangeResult = parseRange(targetStr, t);
    if (!rangeResult.ok) {
      await ctx.reply(formatError(t.read.formatInvalid, t, t.examples.extra));
      return;
    }

    surahStart = rangeResult.value.surahStart;
    ayahStart = rangeResult.value.ayahStart;
    surahEnd = rangeResult.value.surahEnd;
    ayahEnd = rangeResult.value.ayahEnd;

    const validResult = validateRange(
      surahStart,
      ayahStart,
      surahEnd,
      ayahEnd,
      t
    );
    if (!validResult.ok) {
      await ctx.reply(formatError(validResult.error, t));
      return;
    }

    ayahCount = calculateAyahCount(surahStart, ayahStart, surahEnd, ayahEnd);
  }

  const tz = await getTimezone(ctx.db);
  const now = getNowTimestamp(tz);

  // Insert session with type 'extra'
  const result = await insertSession(ctx.db, {
    startedAt: now,
    durationSeconds: durationResult.value,
    surahStart,
    ayahStart,
    surahEnd,
    ayahEnd,
    ayahCount,
    type: "extra",
    pageStart,
    pageEnd,
  });
  if (!result.ok) {
    await ctx.reply(formatError(result.error, t));
    return;
  }

  const msgParts: string[] = [formatSessionConfirmation(result.value, t)];

  await appendSpeedComparison(
    msgParts,
    ctx,
    tz,
    result.value.id,
    durationResult.value,
    pageStart,
    pageEnd,
    ayahCount
  );

  // Check for completed surahs
  appendCompletedSurahs(msgParts, surahStart, ayahStart, surahEnd, ayahEnd, t);

  await ctx.reply(msgParts.join("\n"));
}
