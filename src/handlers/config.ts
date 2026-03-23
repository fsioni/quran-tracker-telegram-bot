import { InlineKeyboard } from "grammy";
import type { CustomContext } from "../bot";
import { DEFAULT_CITY, DEFAULT_COUNTRY, DEFAULT_TZ } from "../config";
import {
  buildWelcome,
  CALLBACK_LANG_SET,
  getBotCommands,
  getLocale,
  LANGUAGES,
} from "../locales";
import type { Locale } from "../locales/types";
import { clearPrayerCache, getConfig, setConfig } from "../services/db";
import { formatError } from "../services/format";
import { invalidateLocaleCache } from "../services/locale-cache";

const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export async function startHandler(ctx: CustomContext): Promise<void> {
  await setConfig(ctx.db, "chat_id", String(ctx.chat?.id));
  await ctx.reply(buildWelcome(ctx.locale));
}

export async function helpHandler(ctx: CustomContext): Promise<void> {
  await ctx.reply(buildWelcome(ctx.locale));
}

async function showCurrentConfig(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
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
      `${t.config.languageLabel} : ${langRaw ? getLocale(langRaw).nativeName : lang}${suffix(langRaw)}`,
    ].join("\n")
  );
}

async function showLanguageKeyboard(ctx: CustomContext): Promise<void> {
  const keyboard = new InlineKeyboard();
  for (const lang of LANGUAGES) {
    const locale = getLocale(lang);
    keyboard.text(locale.nativeName, `${CALLBACK_LANG_SET}:${lang}`);
  }
  await ctx.reply(ctx.locale.config.languageLabel, { reply_markup: keyboard });
}

async function handleConfigUpdate(
  ctx: CustomContext,
  subCommand: string,
  value: string
): Promise<void> {
  const t = ctx.locale;
  switch (subCommand) {
    case "city":
      await Promise.all([
        setConfig(ctx.db, "city", value),
        clearPrayerCache(ctx.db),
      ]);
      await ctx.reply(t.config.cityUpdated(value));
      break;
    case "country":
      if (!COUNTRY_CODE_RE.test(value)) {
        await ctx.reply(
          formatError(t.config.countryCodeInvalid, t, "/config country MX")
        );
        return;
      }
      await Promise.all([
        setConfig(ctx.db, "country", value.toUpperCase()),
        clearPrayerCache(ctx.db),
      ]);
      await ctx.reply(t.config.countryUpdated(value.toUpperCase()));
      break;
    case "timezone":
    case "tz":
      try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
      } catch {
        await ctx.reply(
          formatError(
            t.config.timezoneInvalid,
            t,
            "/config timezone America/Cancun"
          )
        );
        return;
      }
      await setConfig(ctx.db, "timezone", value);
      await ctx.reply(t.config.timezoneUpdated(value));
      break;
    case "language":
    case "lang": {
      const lang = value.toLowerCase();
      if (!LANGUAGES.includes(lang as (typeof LANGUAGES)[number])) {
        await ctx.reply(
          formatError(t.config.languageInvalid(LANGUAGES.join(", ")), t)
        );
        return;
      }
      const newT = await applyLanguageChange(ctx.db, lang, ctx.api);
      await ctx.reply(newT.config.languageUpdated(lang));
      break;
    }
    default:
      await ctx.reply(
        formatError(
          t.config.unknownParam(subCommand),
          t,
          "/config city Playa del Carmen"
        )
      );
  }
}

export async function configHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim();

  if (!input) {
    return showCurrentConfig(ctx);
  }

  const inputLower = input.toLowerCase();
  if (inputLower === "language" || inputLower === "lang") {
    return showLanguageKeyboard(ctx);
  }

  const spaceIdx = input.indexOf(" ");
  if (spaceIdx === -1) {
    await ctx.reply(
      formatError(
        ctx.locale.config.missingValue,
        ctx.locale,
        "/config city Playa del Carmen"
      )
    );
    return;
  }

  const subCommand = input.slice(0, spaceIdx).toLowerCase();
  const value = input.slice(spaceIdx + 1).trim();

  if (!value) {
    await ctx.reply(
      formatError(
        ctx.locale.config.missingValue,
        ctx.locale,
        "/config city Playa del Carmen"
      )
    );
    return;
  }

  return handleConfigUpdate(ctx, subCommand, value);
}

async function applyLanguageChange(
  db: D1Database,
  lang: string,
  api: CustomContext["api"]
): Promise<Locale> {
  await setConfig(db, "language", lang);
  invalidateLocaleCache();
  const newT = getLocale(lang);
  await api.setMyCommands(getBotCommands(newT));
  return newT;
}

export async function langSetCallback(ctx: CustomContext): Promise<void> {
  const lang = (ctx.match as string[] | undefined)?.[1];
  if (!(lang && LANGUAGES.includes(lang as (typeof LANGUAGES)[number]))) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const newT = await applyLanguageChange(ctx.db, lang, ctx.api);
    await Promise.all([
      ctx.answerCallbackQuery(),
      ctx.editMessageText(newT.config.languageUpdated(lang)),
    ]);
  } catch (e) {
    console.error("applyLanguageChange failed:", (e as Error).message);
    await ctx.answerCallbackQuery();
  }
}
