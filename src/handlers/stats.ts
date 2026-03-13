// src/handlers/stats.ts
import type { CustomContext } from "../bot";
import { getHistory } from "../services/db";
import { formatHistoryLine } from "../services/format";

export async function historyHandler(ctx: CustomContext): Promise<void> {
  const sessions = await getHistory(ctx.db);

  if (sessions.length === 0) {
    await ctx.reply("Aucune session enregistree.");
    return;
  }

  const lines = sessions.map(formatHistoryLine);
  await ctx.reply(lines.join("\n"));
}
