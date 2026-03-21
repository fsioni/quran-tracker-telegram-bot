// src/handlers/session.ts
import type { CustomContext } from "../bot";
import {
  parseRange,
  parseDuration,
  formatSessionConfirmation,
  appendCompletedSurahs,
  formatError,
} from "../services/format";
import { validateRange, calculateAyahCount } from "../services/quran";
import { insertSession, getTimezone, getNowTimestamp } from "../services/db";

export async function sessionHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim();
  const parts = input.split(/\s+/);

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

  const validResult = validateRange(surahStart, ayahStart, surahEnd, ayahEnd, t);
  if (!validResult.ok) {
    await ctx.reply(formatError(validResult.error, t));
    return;
  }

  const durationResult = parseDuration(durationStr, t);
  if (!durationResult.ok) {
    await ctx.reply(formatError(durationResult.error, t));
    return;
  }

  const ayahCount = calculateAyahCount(surahStart, ayahStart, surahEnd, ayahEnd);
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
    type: 'normal',
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
