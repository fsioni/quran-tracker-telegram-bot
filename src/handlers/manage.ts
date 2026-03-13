import { InlineKeyboard } from "grammy";
import type { CustomContext } from "../bot";
import {
  getLastSession,
  getSessionById,
  deleteSessionById,
} from "../services/db";
import { formatError, formatRange } from "../services/format";

const CALLBACK_CONFIRM = "delete_confirm";
const CALLBACK_CANCEL = "delete_cancel";

export const CALLBACK_CONFIRM_RE = /^delete_confirm:\d+$/;
export const CALLBACK_CANCEL_RE = /^delete_cancel:\d+$/;

function buildConfirmKeyboard(sessionId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("Confirmer", `${CALLBACK_CONFIRM}:${sessionId}`)
    .text("Annuler", `${CALLBACK_CANCEL}:${sessionId}`);
}

async function askDeleteConfirmation(
  ctx: CustomContext,
  session: { id: number; surahStart: number; ayahStart: number; surahEnd: number; ayahEnd: number },
): Promise<void> {
  const desc = formatRange(session.surahStart, session.ayahStart, session.surahEnd, session.ayahEnd);
  const keyboard = buildConfirmKeyboard(session.id);
  await ctx.reply(`Supprimer la session #${session.id} (${desc}) ?`, {
    reply_markup: keyboard,
  });
}

export async function undoHandler(ctx: CustomContext): Promise<void> {
  const session = await getLastSession(ctx.db);
  if (!session) {
    await ctx.reply("Aucune session a annuler.");
    return;
  }

  await askDeleteConfirmation(ctx, session);
}

export async function deleteHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim();

  if (!input) {
    await ctx.reply(formatError("ID manquant", "/delete 42"));
    return;
  }

  const id = parseInt(input, 10);
  if (isNaN(id) || id <= 0) {
    await ctx.reply(formatError(`ID invalide '${input}'`, "/delete 42"));
    return;
  }

  const session = await getSessionById(ctx.db, id);
  if (!session) {
    await ctx.reply(formatError(`la session #${id} n'existe pas`));
    return;
  }

  await askDeleteConfirmation(ctx, session);
}

export async function confirmDeleteCallback(
  ctx: CustomContext,
): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const id = parseInt(data.split(":")[1], 10);
  const deleted = await deleteSessionById(ctx.db, id);

  if (deleted) {
    await ctx.editMessageText(`Session #${id} supprimee.`);
  } else {
    await ctx.editMessageText(`Session #${id} introuvable.`);
  }
  await ctx.answerCallbackQuery();
}

export async function cancelDeleteCallback(
  ctx: CustomContext,
): Promise<void> {
  await ctx.editMessageText("Suppression annulee.");
  await ctx.answerCallbackQuery();
}
