import { InlineKeyboard } from "grammy";
import type { CustomContext } from "../bot";
import { invalidateLocaleCache } from "../services/localeCache";
import { getConfig, setConfig, clearPrayerCache } from "../services/db";
import { formatError } from "../services/format";
import { DEFAULT_CITY, DEFAULT_COUNTRY, DEFAULT_TZ } from "../config";
import { LANGUAGES, CALLBACK_LANG_SET, getLocale, getBotCommands, buildWelcome } from "../locales";

export async function startHandler(ctx: CustomContext): Promise<void> {
  await setConfig(ctx.db, "chat_id", String(ctx.chat!.id));
  await ctx.reply(buildWelcome(ctx.locale));
}

export async function helpHandler(ctx: CustomContext): Promise<void> {
  await ctx.reply(buildWelcome(ctx.locale));
}

export async function configHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim();

  if (!input) {
    const [cityRaw, countryRaw, timezoneRaw, langRaw] = await Promise.all([
      getConfig(ctx.db, "city"),
      getConfig(ctx.db, "country"),
      getConfig(ctx.db, "timezone"),
      getConfig(ctx.db, "language"),
    ]);
    const city = cityRaw ?? DEFAULT_CITY;
    const country = countryRaw ?? DEFAULT_COUNTRY;
    const timezone = timezoneRaw ?? DEFAULT_TZ;
    const lang = langRaw ?? "en";
    const suffix = (raw: string | null) => (raw ? "" : t.config.defaultSuffix);

    await ctx.reply(
      [
        t.config.title,
        `${t.config.cityLabel} : ${city}${suffix(cityRaw)}`,
        `${t.config.countryLabel} : ${country}${suffix(countryRaw)}`,
        `${t.config.timezoneLabel} : ${timezone}${suffix(timezoneRaw)}`,
        `${t.config.languageLabel} : ${lang}${suffix(langRaw)}`,
      ].join("\n"),
    );
    return;
  }

  // Handle "/config language" or "/config lang" without a value -> show keyboard
  const inputLower = input.toLowerCase();
  if (inputLower === "language" || inputLower === "lang") {
    const keyboard = new InlineKeyboard();
    for (const lang of LANGUAGES) {
      const locale = getLocale(lang);
      keyboard.text(locale.nativeName, `${CALLBACK_LANG_SET}:${lang}`);
    }
    await ctx.reply(t.config.languageLabel, { reply_markup: keyboard });
    return;
  }

  const spaceIdx = input.indexOf(" ");
  if (spaceIdx === -1) {
    await ctx.reply(formatError(t.config.missingValue, t, "/config city Playa del Carmen"));
    return;
  }

  const subCommand = input.substring(0, spaceIdx).toLowerCase();
  const value = input.substring(spaceIdx + 1).trim();

  if (!value) {
    await ctx.reply(formatError(t.config.missingValue, t, "/config city Playa del Carmen"));
    return;
  }

  switch (subCommand) {
    case "city":
      await Promise.all([setConfig(ctx.db, "city", value), clearPrayerCache(ctx.db)]);
      await ctx.reply(t.config.cityUpdated(value));
      break;
    case "country":
      if (!/^[A-Za-z]{2}$/.test(value)) {
        await ctx.reply(formatError(t.config.countryCodeInvalid, t, "/config country MX"));
        return;
      }
      await Promise.all([setConfig(ctx.db, "country", value.toUpperCase()), clearPrayerCache(ctx.db)]);
      await ctx.reply(t.config.countryUpdated(value.toUpperCase()));
      break;
    case "timezone":
    case "tz":
      try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
      } catch {
        await ctx.reply(formatError(t.config.timezoneInvalid, t, "/config timezone America/Cancun"));
        return;
      }
      await setConfig(ctx.db, "timezone", value);
      await ctx.reply(t.config.timezoneUpdated(value));
      break;
    case "language":
    case "lang": {
      const lang = value.toLowerCase();
      if (!LANGUAGES.includes(lang as typeof LANGUAGES[number])) {
        await ctx.reply(formatError(t.config.languageInvalid(LANGUAGES.join(", ")), t));
        return;
      }
      const newT = await applyLanguageChange(ctx.db, lang, ctx.api);
      await ctx.reply(newT.config.languageUpdated(lang));
      break;
    }
    default:
      await ctx.reply(formatError(t.config.unknownParam(subCommand), t, "/config city Playa del Carmen"));
  }
}

async function applyLanguageChange(db: D1Database, lang: string, api: CustomContext["api"]): Promise<Locale> {
  await setConfig(db, "language", lang);
  invalidateLocaleCache();
  const newT = getLocale(lang);
  await api.setMyCommands(getBotCommands(newT));
  return newT;
}

export async function langSetCallback(ctx: CustomContext): Promise<void> {
  const lang = (ctx.match as string[] | undefined)?.[1];
  if (!lang || !LANGUAGES.includes(lang as typeof LANGUAGES[number])) return;

  const newT = await applyLanguageChange(ctx.db, lang, ctx.api);
  await Promise.all([
    ctx.answerCallbackQuery(),
    ctx.editMessageText(newT.config.languageUpdated(lang)),
  ]);
}
