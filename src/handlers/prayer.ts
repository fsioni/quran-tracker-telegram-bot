import type { CustomContext } from "../bot";
import type { PrayerName } from "../services/db";
import { getConfig, getTodayInTimezone, deletePrayerCacheForDate, setPrayerCache } from "../services/db";
import { fetchPrayerTimes } from "../services/prayer";
import { formatError } from "../services/format";
import { DEFAULT_TZ, DEFAULT_CITY, DEFAULT_COUNTRY } from "../config";

const PRAYER_LABELS: Record<PrayerName, string> = {
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

  const result = await fetchPrayerTimes(today, city, country);
  if (!result.ok) {
    await ctx.reply(formatError(`impossible de recuperer les horaires : ${result.error}`));
    return;
  }

  await deletePrayerCacheForDate(ctx.db, today);
  await setPrayerCache(ctx.db, result.value);

  const times = result.value;
  const lines = [
    `Horaires de priere - ${city}, ${country}`,
    `Date : ${today}`,
    "",
    ...(Object.entries(PRAYER_LABELS) as [PrayerName, string][]).map(
      ([key, label]) => `${label} : ${times[key]}`,
    ),
    "",
    "Cache rafraichi.",
  ];

  await ctx.reply(lines.join("\n"));
}
