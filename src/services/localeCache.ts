import { getConfig } from "./db";
import { type Locale, getLocale } from "../locales";

let cachedLocale: Locale | null = null;

export function invalidateLocaleCache(): void {
  cachedLocale = null;
}

export async function resolveLocale(db: D1Database): Promise<Locale> {
  if (cachedLocale) return cachedLocale;
  const lang = await getConfig(db, "language");
  cachedLocale = getLocale(lang);
  return cachedLocale;
}
