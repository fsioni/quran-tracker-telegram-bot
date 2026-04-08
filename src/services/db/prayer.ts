import { addDays } from "./date-helpers";
import type { PrayerCacheRow, PrayerName, PrayerTimes } from "./types";

export async function getPrayerCache(
  db: D1Database,
  date: string
): Promise<PrayerCacheRow | null> {
  const row = await db
    .prepare("SELECT * FROM prayer_cache WHERE date = ?")
    .bind(date)
    .first<PrayerCacheRow>();
  return row ?? null;
}

export async function setPrayerCache(
  db: D1Database,
  times: PrayerTimes
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO prayer_cache (date, fajr, dhuhr, asr, maghrib, isha)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         fajr = excluded.fajr,
         dhuhr = excluded.dhuhr,
         asr = excluded.asr,
         maghrib = excluded.maghrib,
         isha = excluded.isha,
         fetched_at = datetime('now')`
    )
    .bind(
      times.date,
      times.fajr,
      times.dhuhr,
      times.asr,
      times.maghrib,
      times.isha
    )
    .run();
}

const VALID_PRAYER_NAMES: ReadonlySet<string> = new Set([
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
]);

export async function markPrayerSent(
  db: D1Database,
  date: string,
  prayer: PrayerName
): Promise<void> {
  if (!VALID_PRAYER_NAMES.has(prayer)) {
    throw new Error(`Invalid prayer name: ${prayer}`);
  }
  await db
    .prepare(`UPDATE prayer_cache SET ${prayer}_sent = 1 WHERE date = ?`)
    .bind(date)
    .run();
}

export async function markStreakFollowupSent(
  db: D1Database,
  date: string
): Promise<void> {
  await db
    .prepare("UPDATE prayer_cache SET streak_followup_sent = 1 WHERE date = ?")
    .bind(date)
    .run();
}

export async function cleanOldCache(
  db: D1Database,
  today: string
): Promise<void> {
  const cutoff = addDays(today, -7);
  await db
    .prepare("DELETE FROM prayer_cache WHERE date < ?")
    .bind(cutoff)
    .run();
}

export async function deletePrayerCacheForDate(
  db: D1Database,
  date: string
): Promise<void> {
  await db.prepare("DELETE FROM prayer_cache WHERE date = ?").bind(date).run();
}

export async function clearPrayerCache(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM prayer_cache").run();
}
