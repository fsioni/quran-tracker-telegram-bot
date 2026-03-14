import type { CustomContext } from "../bot";
import { getConfig, setConfig } from "../services/db";
import { formatError } from "../services/format";

export const WELCOME_MESSAGE = `Bienvenue sur le Quran Reading Tracker !

Commandes disponibles :
/session - Enregistrer une session de lecture
/import - Importer des sessions
/history - Historique des sessions
/stats - Statistiques de lecture
/progress - Progression dans le Coran
/config - Configurer ville, pays, fuseau horaire
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

export async function configHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim();

  if (!input) {
    const city = (await getConfig(ctx.db, "city")) ?? "Non defini";
    const country = (await getConfig(ctx.db, "country")) ?? "Non defini";
    const timezone = (await getConfig(ctx.db, "timezone")) ?? "Non defini";

    await ctx.reply(
      [
        "-- Configuration --",
        `Ville : ${city}`,
        `Pays : ${country}`,
        `Fuseau horaire : ${timezone}`,
      ].join("\n"),
    );
    return;
  }

  const spaceIdx = input.indexOf(" ");
  if (spaceIdx === -1) {
    await ctx.reply(formatError("valeur manquante", "/config city Playa del Carmen"));
    return;
  }

  const subCommand = input.substring(0, spaceIdx).toLowerCase();
  const value = input.substring(spaceIdx + 1).trim();

  if (!value) {
    await ctx.reply(formatError("valeur manquante", "/config city Playa del Carmen"));
    return;
  }

  switch (subCommand) {
    case "city":
      await setConfig(ctx.db, "city", value);
      await ctx.reply(`Ville mise a jour : ${value}`);
      break;
    case "country":
      if (!/^[A-Za-z]{2}$/.test(value)) {
        await ctx.reply(formatError("le code pays doit faire 2 lettres (ISO)", "/config country MX"));
        return;
      }
      await setConfig(ctx.db, "country", value.toUpperCase());
      await ctx.reply(`Pays mis a jour : ${value.toUpperCase()}`);
      break;
    case "timezone":
    case "tz":
      await setConfig(ctx.db, "timezone", value);
      await ctx.reply(`Fuseau horaire mis a jour : ${value}`);
      break;
    default:
      await ctx.reply(formatError(`parametre inconnu '${subCommand}'`, "/config city Playa del Carmen"));
  }
}
