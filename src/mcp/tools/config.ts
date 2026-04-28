import { DEFAULT_CITY, DEFAULT_COUNTRY, DEFAULT_TZ } from "../../config";
import { getConfig } from "../../services/db/config";
import { getTodayInTimezone } from "../../services/db/date-helpers";

export async function getConfigTool(input: { db: D1Database }) {
  const [city, country, tz] = await Promise.all([
    getConfig(input.db, "city"),
    getConfig(input.db, "country"),
    getConfig(input.db, "timezone"),
  ]);
  const timezone = tz ?? DEFAULT_TZ;
  return {
    city: city ?? DEFAULT_CITY,
    country: country ?? DEFAULT_COUNTRY,
    timezone,
    today: getTodayInTimezone(timezone),
  };
}
