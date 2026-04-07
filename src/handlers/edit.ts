import type { CustomContext } from "../bot";
import { getSessionById, updateSessionDuration } from "../services/db/sessions";
import {
  formatDuration,
  formatError,
  formatRange,
  parseDuration,
} from "../services/format";

const WHITESPACE_RE = /\s+/;

export async function editHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim();

  if (!input) {
    await ctx.reply(formatError(t.edit.missingArgs, t, t.examples.edit));
    return;
  }

  const parts = input.split(WHITESPACE_RE);
  if (parts.length < 2) {
    await ctx.reply(formatError(t.edit.missingArgs, t, t.examples.edit));
    return;
  }

  const id = Number.parseInt(parts[0], 10);
  if (Number.isNaN(id) || id <= 0) {
    await ctx.reply(
      formatError(t.edit.invalidId(parts[0]), t, t.examples.edit)
    );
    return;
  }

  const durationResult = parseDuration(parts[1], t);
  if (!durationResult.ok) {
    await ctx.reply(formatError(durationResult.error, t, t.examples.edit));
    return;
  }

  const session = await getSessionById(ctx.db, id);
  if (!session) {
    await ctx.reply(formatError(t.edit.sessionNotFound(id), t));
    return;
  }

  const oldDuration = formatDuration(session.durationSeconds, t);
  const updated = await updateSessionDuration(ctx.db, id, durationResult.value);
  if (!updated) {
    await ctx.reply(formatError(t.edit.sessionNotFound(id), t));
    return;
  }

  const newDuration = formatDuration(updated.durationSeconds, t);
  const range = formatRange(
    updated.surahStart,
    updated.ayahStart,
    updated.surahEnd,
    updated.ayahEnd,
    t
  );

  await ctx.reply(t.edit.sessionEdited(id, range, oldDuration, newDuration));
}
