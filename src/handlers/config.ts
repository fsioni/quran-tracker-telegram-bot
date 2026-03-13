import type { CustomContext } from "../bot";
import { setConfig } from "../services/db";

export const WELCOME_MESSAGE = `Bienvenue sur le Quran Reading Tracker !

Commandes disponibles :
/session - Enregistrer une session de lecture
/import - Importer des sessions
/history - Historique des sessions
/undo - Annuler la derniere session
/delete - Supprimer une session
/help - Afficher l'aide`;

export async function startHandler(ctx: CustomContext): Promise<void> {
  await setConfig(ctx.db, "chat_id", String(ctx.chat!.id));
  await ctx.reply(WELCOME_MESSAGE);
}

export async function helpHandler(ctx: CustomContext): Promise<void> {
  await ctx.reply(WELCOME_MESSAGE);
}
