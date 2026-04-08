// src/handlers/session.ts
import type { CustomContext } from "../bot";
import { getNowTimestamp, getTimezone } from "../services/db/date-helpers";
import { insertSession } from "../services/db/sessions";
import { get7DayTypeAvgSpeed } from "../services/db/speed";
import {
  appendCompletedSurahs,
  formatError,
  formatSessionConfirmation,
  formatSpeedComparison,
  parseDuration,
  parseRange,
} from "../services/format";
import { calculateAyahCount, validateRange } from "../services/quran";

const WHITESPACE_RE = /\s+/;

export async function sessionHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim();
  const parts = input.split(WHITESPACE_RE);

  if (parts.length < 2 || !parts[0]) {
    await ctx.reply(formatError(t.read.formatInvalid, t, t.examples.session));
    return;
  }

  const [rangeStr, durationStr] = parts;

  const rangeResult = parseRange(rangeStr, t);
  if (!rangeResult.ok) {
    await ctx.reply(formatError(rangeResult.error, t, t.examples.session));
    return;
  }

  const { surahStart, ayahStart, surahEnd, ayahEnd } = rangeResult.value;

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

  const durationResult = parseDuration(durationStr, t);
  if (!durationResult.ok) {
    await ctx.reply(formatError(durationResult.error, t));
    return;
  }

  const ayahCount = calculateAyahCount(
    surahStart,
    ayahStart,
    surahEnd,
    ayahEnd
  );
  const tz = await getTimezone(ctx.db);
  const now = getNowTimestamp(tz);

  const result = await insertSession(ctx.db, {
    startedAt: now,
    durationSeconds: durationResult.value,
    surahStart,
    ayahStart,
    surahEnd,
    ayahEnd,
    ayahCount,
    type: "normal",
  });
  if (!result.ok) {
    await ctx.reply(formatError(result.error, t));
    return;
  }

  const msgParts: string[] = [formatSessionConfirmation(result.value, t)];

  if (durationResult.value > 0) {
    const avg = await get7DayTypeAvgSpeed(
      ctx.db,
      "normal",
      tz,
      result.value.id
    );
    const currentSpeed = ayahCount / (durationResult.value / 3600);
    const comparison = formatSpeedComparison(
      currentSpeed,
      avg.versesPerHour,
      t
    );
    if (comparison) {
      msgParts.push(comparison);
    }
  }

  // Check for completed surahs
  appendCompletedSurahs(msgParts, surahStart, ayahStart, surahEnd, ayahEnd, t);

  await ctx.reply(msgParts.join("\n"));
}
