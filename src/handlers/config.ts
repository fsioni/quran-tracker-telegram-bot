import type { CustomContext } from "../bot";
import { getConfig, setConfig } from "../services/db";
import { formatError } from "../services/format";
import { DEFAULT_CITY, DEFAULT_COUNTRY, DEFAULT_TZ } from "../config";

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
    const [cityRaw, countryRaw, timezoneRaw] = await Promise.all([
      getConfig(ctx.db, "city"),
      getConfig(ctx.db, "country"),
      getConfig(ctx.db, "timezone"),
    ]);
    const city = cityRaw ?? DEFAULT_CITY;
    const country = countryRaw ?? DEFAULT_COUNTRY;
    const timezone = timezoneRaw ?? DEFAULT_TZ;
    const suffix = (raw: string | null) => (raw ? "" : " (defaut)");


    await ctx.reply(
      [
        "-- Configuration --",
        `Ville : ${city}${suffix(cityRaw)}`,
        `Pays : ${country}${suffix(countryRaw)}`,
        `Fuseau horaire : ${timezone}${suffix(timezoneRaw)}`,
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
      try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
      } catch {
        await ctx.reply(formatError("fuseau horaire invalide", "/config timezone America/Cancun"));
        return;
      }
      await setConfig(ctx.db, "timezone", value);
      await ctx.reply(`Fuseau horaire mis a jour : ${value}`);
      break;
    default:
      await ctx.reply(formatError(`parametre inconnu '${subCommand}'`, "/config city Playa del Carmen"));
  }
}
