import type { CustomContext } from "../bot";
import { setConfig } from "../services/db";

export const WELCOME_MESSAGE = `Bienvenue sur le Quran Reading Tracker !

Commandes disponibles :
/start - Demarrer le bot
/help - Afficher l'aide
/session - Enregistrer une session de lecture
/import - Importer des sessions
/stats - Voir les statistiques
/progress - Voir la progression
/history - Historique des sessions
/undo - Annuler la derniere session
/delete - Supprimer une session
/config - Configuration`;

export async function startHandler(ctx: CustomContext): Promise<void> {
  await setConfig(ctx.db, "chat_id", String(ctx.chat!.id));
  await ctx.reply(WELCOME_MESSAGE);
}

export async function helpHandler(ctx: CustomContext): Promise<void> {
  await ctx.reply(WELCOME_MESSAGE);
}
