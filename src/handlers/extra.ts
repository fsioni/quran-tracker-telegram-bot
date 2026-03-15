// src/handlers/extra.ts
import type { CustomContext } from "../bot";
import {
  parseDuration,
  parsePage,
  parseRange,
  formatSessionConfirmation,
  formatError,
} from "../services/format";
import { getPageRange } from "../data/pages";
import { validateRange, calculateAyahCount } from "../services/quran";
import { insertSession, getTimezone, getNowTimestamp } from "../services/db";

export async function extraHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim();
  const parts = input.split(/\s+/);

  if (parts.length < 2 || !parts[0]) {
    await ctx.reply(
      formatError("format invalide", "/extra 300 5m ou /extra 2:77-83 8m"),
    );
    return;
  }

  const [targetStr, durationStr] = parts;

  // Parse duration first to fail fast
  const durationResult = parseDuration(durationStr);
  if (!durationResult.ok) {
    await ctx.reply(formatError(durationResult.error));
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
  const pageResult = parsePage(targetStr);
  if (pageResult.ok) {
    pageStart = pageResult.value.pageStart;
    pageEnd = pageResult.value.pageEnd;

    const rangeData = getPageRange(pageStart, pageEnd);
    if (!rangeData) {
      await ctx.reply(formatError("pages invalides"));
      return;
    }

    surahStart = rangeData.surahStart;
    ayahStart = rangeData.ayahStart;
    surahEnd = rangeData.surahEnd;
    ayahEnd = rangeData.ayahEnd;
    ayahCount = rangeData.ayahCount;
  } else if (/^\d+(-\d+)?$/.test(targetStr)) {
    // Looks like a page number/range but parsePage rejected it (e.g. 0, 605)
    await ctx.reply(formatError(pageResult.error));
    return;
  } else {
    const rangeResult = parseRange(targetStr);
    if (!rangeResult.ok) {
      await ctx.reply(
        formatError(
          "format invalide",
          "/extra 300 5m ou /extra 2:77-83 8m",
        ),
      );
      return;
    }

    surahStart = rangeResult.value.surahStart;
    ayahStart = rangeResult.value.ayahStart;
    surahEnd = rangeResult.value.surahEnd;
    ayahEnd = rangeResult.value.ayahEnd;

    const validResult = validateRange(surahStart, ayahStart, surahEnd, ayahEnd);
    if (!validResult.ok) {
      await ctx.reply(formatError(validResult.error));
      return;
    }

    ayahCount = calculateAyahCount(surahStart, ayahStart, surahEnd, ayahEnd);
  }

  const tz = await getTimezone(ctx.db);
  const now = getNowTimestamp(tz);

  // Insert session with type 'extra'
  const session = await insertSession(ctx.db, {
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

  await ctx.reply(formatSessionConfirmation(session));
}
