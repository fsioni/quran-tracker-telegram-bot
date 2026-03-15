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
  const input = ((ctx.match as string) || "").trim();
  const parts = input.split(/\s+/);

  if (parts.length < 2 || !parts[0]) {
    await ctx.reply(formatError("format invalide", "/session 2:77-83 8m53"));
    return;
  }

  const [rangeStr, durationStr] = parts;

  const rangeResult = parseRange(rangeStr);
  if (!rangeResult.ok) {
    await ctx.reply(formatError(rangeResult.error, "/session 2:77-83 8m53"));
    return;
  }

  const { surahStart, ayahStart, surahEnd, ayahEnd } = rangeResult.value;

  const validResult = validateRange(surahStart, ayahStart, surahEnd, ayahEnd);
  if (!validResult.ok) {
    await ctx.reply(formatError(validResult.error));
    return;
  }

  const durationResult = parseDuration(durationStr);
  if (!durationResult.ok) {
    await ctx.reply(formatError(durationResult.error));
    return;
  }

  const ayahCount = calculateAyahCount(surahStart, ayahStart, surahEnd, ayahEnd);
  const tz = await getTimezone(ctx.db);
  const now = getNowTimestamp(tz);

  const session = await insertSession(ctx.db, {
    startedAt: now,
    durationSeconds: durationResult.value,
    surahStart,
    ayahStart,
    surahEnd,
    ayahEnd,
    ayahCount,
    type: 'normal',
  });

  const msgParts: string[] = [formatSessionConfirmation(session)];

  // Check for completed surahs
  appendCompletedSurahs(msgParts, surahStart, ayahStart, surahEnd, ayahEnd);

  await ctx.reply(msgParts.join("\n"));
}
