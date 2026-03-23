import { InlineKeyboard } from "grammy";
import type { CustomContext } from "../bot";
import type { Locale } from "../locales";
import {
  deleteSessionById,
  getLastSession,
  getSessionById,
} from "../services/db";
import { formatDuration, formatError, formatRange } from "../services/format";

const CALLBACK_CONFIRM = "delete_confirm";
const CALLBACK_CANCEL = "delete_cancel";

export const CALLBACK_CONFIRM_RE = /^delete_confirm:\d+$/;
export const CALLBACK_CANCEL_RE = /^delete_cancel:\d+$/;

function buildConfirmKeyboard(sessionId: number, t: Locale): InlineKeyboard {
  return new InlineKeyboard()
    .text(t.manage.confirm, `${CALLBACK_CONFIRM}:${sessionId}`)
    .text(t.manage.cancel, `${CALLBACK_CANCEL}:${sessionId}`);
}

async function askDeleteConfirmation(
  ctx: CustomContext,
  session: {
    id: number;
    surahStart: number;
    ayahStart: number;
    surahEnd: number;
    ayahEnd: number;
  }
): Promise<void> {
  const t = ctx.locale;
  const desc = formatRange(
    session.surahStart,
    session.ayahStart,
    session.surahEnd,
    session.ayahEnd,
    t
  );
  const keyboard = buildConfirmKeyboard(session.id, t);
  await ctx.reply(t.manage.deletePrompt(session.id, desc), {
    reply_markup: keyboard,
  });
}

export async function undoHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const session = await getLastSession(ctx.db);
  if (!session) {
    await ctx.reply(t.manage.noSessionToUndo);
    return;
  }

  await askDeleteConfirmation(ctx, session);
}

export async function deleteHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim();

  if (!input) {
    await ctx.reply(formatError(t.manage.missingId, t, "/delete 42"));
    return;
  }

  const id = Number.parseInt(input, 10);
  if (isNaN(id) || id <= 0) {
    await ctx.reply(formatError(t.manage.invalidId(input), t, "/delete 42"));
    return;
  }

  const session = await getSessionById(ctx.db, id);
  if (!session) {
    await ctx.reply(formatError(t.manage.sessionNotFound(id), t));
    return;
  }

  await askDeleteConfirmation(ctx, session);
}

export async function confirmDeleteCallback(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const data = ctx.callbackQuery?.data;
  if (!(data && CALLBACK_CONFIRM_RE.test(data))) {
    await ctx.answerCallbackQuery();
    return;
  }

  const id = Number.parseInt(data.split(":")[1], 10);
  const session = await deleteSessionById(ctx.db, id);

  if (session) {
    const range = formatRange(
      session.surahStart,
      session.ayahStart,
      session.surahEnd,
      session.ayahEnd,
      t
    );
    const duration = formatDuration(session.durationSeconds);
    await ctx.editMessageText(
      t.manage.sessionDeleted(id, range, session.ayahCount, duration)
    );
  } else {
    await ctx.editMessageText(t.manage.sessionNotFoundShort(id));
  }
  await ctx.answerCallbackQuery();
}

export async function cancelDeleteCallback(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  await ctx.editMessageText(t.manage.deletionCancelled);
  await ctx.answerCallbackQuery();
}
