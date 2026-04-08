// src/handlers/extra.ts
import { InlineKeyboard } from "grammy";
import type { CustomContext } from "../bot";
import { getPageRange } from "../data/pages";
import { getNowTimestamp, getTimezone } from "../services/db/date-helpers";
import { insertSession } from "../services/db/sessions";
import {
  appendCompletedSurahs,
  formatError,
  formatRange,
  formatSessionConfirmation,
  parseDuration,
  parsePage,
  parseRange,
} from "../services/format";
import { calculateAyahCount, validateRange } from "../services/quran";
import { err, ok, type Result } from "../types";

const WHITESPACE_RE = /\s+/;
const PAGE_OR_RANGE_RE = /^\d+(-\d+)?$/;

// Callback data for no-duration extra confirmation
export const CALLBACK_EXTRA_NODUR_CONFIRM_RE = /^nde_c:(.+)$/;

export async function extraHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim();
  const parts = input.split(WHITESPACE_RE);

  if (!parts[0]) {
    await ctx.reply(formatError(t.read.formatInvalid, t, t.examples.extra));
    return;
  }

  const [targetStr, durationStr] = parts;

  // Parse optional duration
  let durationSeconds: number | null = null;
  if (durationStr) {
    const durationResult = parseDuration(durationStr, t);
    if (!durationResult.ok) {
      await ctx.reply(formatError(durationResult.error, t));
      return;
    }
    durationSeconds = durationResult.value;
  }

  // Validate target (page or verse range)
  const validation = validateTarget(targetStr, t);
  if (!validation.ok) {
    await ctx.reply(formatError(validation.error, t, t.examples.extra));
    return;
  }

  // No-duration: ask confirmation before inserting
  if (durationSeconds === null) {
    const range = formatRange(
      validation.value.surahStart,
      validation.value.ayahStart,
      validation.value.surahEnd,
      validation.value.ayahEnd,
      t
    );
    const msg = `${t.session.extraRecorded} ${range} -- ${t.session.noDurationPrompt}`;
    const keyboard = new InlineKeyboard()
      .text(t.manage.confirm, `nde_c:${targetStr}`)
      .text(t.manage.cancel, "nde_x");
    await ctx.reply(msg, { reply_markup: keyboard });
    return;
  }

  await insertAndReplyExtra(ctx, validation.value, durationSeconds);
}

interface ValidatedTarget {
  ayahCount: number;
  ayahEnd: number;
  ayahStart: number;
  pageEnd?: number;
  pageStart?: number;
  surahEnd: number;
  surahStart: number;
}

function validateTarget(
  targetStr: string,
  t: import("../locales/types").Locale
): Result<ValidatedTarget> {
  const pageResult = parsePage(targetStr, t);
  if (pageResult.ok) {
    const { pageStart, pageEnd } = pageResult.value;
    const rangeData = getPageRange(pageStart, pageEnd);
    if (!rangeData) {
      return err(t.read.pagesInvalid);
    }
    return ok({
      surahStart: rangeData.surahStart,
      ayahStart: rangeData.ayahStart,
      surahEnd: rangeData.surahEnd,
      ayahEnd: rangeData.ayahEnd,
      ayahCount: rangeData.ayahCount,
      pageStart,
      pageEnd,
    });
  }

  if (PAGE_OR_RANGE_RE.test(targetStr)) {
    return err(pageResult.error);
  }

  const rangeResult = parseRange(targetStr, t);
  if (!rangeResult.ok) {
    return err(t.read.formatInvalid);
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
    return err(validResult.error);
  }

  return ok({
    surahStart,
    ayahStart,
    surahEnd,
    ayahEnd,
    ayahCount: calculateAyahCount(surahStart, ayahStart, surahEnd, ayahEnd),
  });
}

async function insertAndReplyExtra(
  ctx: CustomContext,
  target: ValidatedTarget,
  durationSeconds: number | null
): Promise<void> {
  const t = ctx.locale;
  const tz = await getTimezone(ctx.db);
  const now = getNowTimestamp(tz);

  const result = await insertSession(ctx.db, {
    startedAt: now,
    durationSeconds,
    surahStart: target.surahStart,
    ayahStart: target.ayahStart,
    surahEnd: target.surahEnd,
    ayahEnd: target.ayahEnd,
    ayahCount: target.ayahCount,
    type: "extra",
    pageStart: target.pageStart,
    pageEnd: target.pageEnd,
  });
  if (!result.ok) {
    await ctx.reply(formatError(result.error, t));
    return;
  }

  const msgParts: string[] = [formatSessionConfirmation(result.value, t)];
  appendCompletedSurahs(
    msgParts,
    target.surahStart,
    target.ayahStart,
    target.surahEnd,
    target.ayahEnd,
    t
  );
  await ctx.reply(msgParts.join("\n"));
}

export async function confirmExtraNoDurCallback(
  ctx: CustomContext
): Promise<void> {
  const t = ctx.locale;
  const data = ctx.callbackQuery?.data;
  const match = data?.match(CALLBACK_EXTRA_NODUR_CONFIRM_RE);
  if (!match) {
    await ctx.answerCallbackQuery();
    return;
  }

  const targetStr = match[1];
  const validation = validateTarget(targetStr, t);
  if (!validation.ok) {
    await ctx.editMessageText(formatError(validation.error, t));
    await ctx.answerCallbackQuery();
    return;
  }

  await insertAndReplyExtra(ctx, validation.value, null);
  await ctx.answerCallbackQuery();
}
