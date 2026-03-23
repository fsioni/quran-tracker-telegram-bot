import { getLocale, type Locale } from "../locales";
import { getConfig } from "./db";

let cachedLocale: Locale | null = null;

export function invalidateLocaleCache(): void {
  cachedLocale = null;
}

export async function resolveLocale(
  db: D1Database,
  telegramLangCode: string | null = null
): Promise<Locale> {
  if (cachedLocale) {
    return cachedLocale;
  }
  const lang = await getConfig(db, "language");
  // If no language in DB, use Telegram's language_code as fallback (extract 2-letter prefix)
  const fallback = telegramLangCode
    ? telegramLangCode.slice(0, 2).toLowerCase()
    : null;
  cachedLocale = getLocale(lang ?? fallback);
  return cachedLocale;
}
