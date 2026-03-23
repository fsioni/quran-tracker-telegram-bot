import type { CustomContext } from "../bot";
import { DEFAULT_CITY, DEFAULT_COUNTRY, DEFAULT_TZ } from "../config";
import type { PrayerName } from "../services/db";
import {
  deletePrayerCacheForDate,
  getConfig,
  getTodayInTimezone,
  setPrayerCache,
} from "../services/db";
import { formatError } from "../services/format";
import { fetchPrayerTimes } from "../services/prayer";

function getPrayerLabels(
  t: CustomContext["locale"]
): Record<PrayerName, string> {
  return {
    fajr: t.prayer.fajr,
    dhuhr: t.prayer.dhuhr,
    asr: t.prayer.asr,
    maghrib: t.prayer.maghrib,
    isha: t.prayer.isha,
  };
}

export async function prayerHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
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

  const result = await fetchPrayerTimes(today, city, country, t);
  if (!result.ok) {
    await ctx.reply(formatError(t.prayer.fetchError(result.error), t));
    return;
  }

  await deletePrayerCacheForDate(ctx.db, today);
  await setPrayerCache(ctx.db, result.value);

  const times = result.value;
  const labels = getPrayerLabels(t);
  const lines = [
    t.prayer.title(city, country),
    `${t.prayer.date} : ${today}`,
    "",
    ...(Object.entries(labels) as [PrayerName, string][]).map(
      ([key, label]) => `${label} : ${times[key]}`
    ),
    "",
    t.prayer.cacheRefreshed,
  ];

  await ctx.reply(lines.join("\n"));
}
