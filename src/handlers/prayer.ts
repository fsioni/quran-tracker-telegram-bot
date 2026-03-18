import type { CustomContext } from "../bot";
import { getConfig, getTodayInTimezone, deletePrayerCacheForDate, setPrayerCache } from "../services/db";
import { fetchPrayerTimes } from "../services/prayer";
import { DEFAULT_TZ, DEFAULT_CITY, DEFAULT_COUNTRY } from "../config";

const PRAYER_LABELS: Record<string, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export async function prayerHandler(ctx: CustomContext): Promise<void> {
  const [tzRaw, cityRaw, countryRaw] = await Promise.all([
    getConfig(ctx.db, "timezone"),
    getConfig(ctx.db, "city"),
    getConfig(ctx.db, "country"),
  ]);

  let tz = tzRaw ?? DEFAULT_TZ;
  const city = cityRaw ?? DEFAULT_CITY;
  const country = countryRaw ?? DEFAULT_COUNTRY;

  let today: string;
  try {
    today = getTodayInTimezone(tz);
  } catch {
    tz = DEFAULT_TZ;
    today = getTodayInTimezone(tz);
  }

  await deletePrayerCacheForDate(ctx.db, today);

  const result = await fetchPrayerTimes(today, city, country);
  if (!result.ok) {
    await ctx.reply(`Erreur lors du fetch des horaires : ${result.error}`);
    return;
  }

  await setPrayerCache(ctx.db, result.value);

  const times = result.value;
  const lines = [
    `Horaires de priere - ${city}, ${country}`,
    `Date : ${today}`,
    "",
    ...Object.entries(PRAYER_LABELS).map(
      ([key, label]) => `${label} : ${times[key as keyof typeof times]}`,
    ),
    "",
    "Cache rafraichi.",
  ];

  await ctx.reply(lines.join("\n"));
}
