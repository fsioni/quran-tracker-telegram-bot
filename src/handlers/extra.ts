// src/handlers/extra.ts
import type { CustomContext } from "../bot";
import { getPageRange } from "../data/pages";
import { getNowTimestamp, getTimezone, insertSession } from "../services/db";
import {
  appendCompletedSurahs,
  formatError,
  formatSessionConfirmation,
  parseDuration,
  parsePage,
  parseRange,
} from "../services/format";
import { calculateAyahCount, validateRange } from "../services/quran";

export async function extraHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim();
  const parts = input.split(/\s+/);

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
  } else if (/^\d+(-\d+)?$/.test(targetStr)) {
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

  // Check for completed surahs
  appendCompletedSurahs(msgParts, surahStart, ayahStart, surahEnd, ayahEnd, t);

  await ctx.reply(msgParts.join("\n"));
}
