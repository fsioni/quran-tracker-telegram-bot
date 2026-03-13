// --- Row types (D1 snake_case) ---

type SessionRow = {
  id: number;
  started_at: string;
  duration_seconds: number;
  surah_start: number;
  ayah_start: number;
  surah_end: number;
  ayah_end: number;
  ayah_count: number;
  created_at: string;
};

// --- Public types (camelCase) ---

export type Session = {
  id: number;
  startedAt: string;
  durationSeconds: number;
  surahStart: number;
  ayahStart: number;
  surahEnd: number;
  ayahEnd: number;
  ayahCount: number;
  createdAt: string;
};

export type GlobalStats = {
  totalSessions: number;
  totalAyahs: number;
  totalSeconds: number;
  avgAyahsPerSession: number;
  avgSecondsPerSession: number;
};

export type PeriodStats = {
  sessions: number;
  ayahs: number;
  seconds: number;
};

export type StreakResult = {
  currentStreak: number;
  bestStreak: number;
};

export type PrayerTimes = {
  date: string;
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

export type PrayerCacheRow = PrayerTimes & {
  fajr_sent: number;
  dhuhr_sent: number;
  asr_sent: number;
  maghrib_sent: number;
  isha_sent: number;
  fetched_at: string;
};

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

// --- Internal helpers ---

function mapRow(row: SessionRow): Session {
  return {
    id: row.id,
    startedAt: row.started_at,
    durationSeconds: row.duration_seconds,
    surahStart: row.surah_start,
    ayahStart: row.ayah_start,
    surahEnd: row.surah_end,
    ayahEnd: row.ayah_end,
    ayahCount: row.ayah_count,
    createdAt: row.created_at,
  };
}

export function getTodayInTimezone(tz: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekBounds(today: string): { start: string; end: string } {
  const d = new Date(today + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sunday
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const start = addDays(today, diffToMonday);
  const end = addDays(start, 6);
  return { start, end };
}

export function getMonthBounds(today: string): { start: string; end: string } {
  const d = new Date(today + "T00:00:00Z");
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-based
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

// --- Session data param ---

type InsertSessionData = {
  startedAt: string;
  durationSeconds: number;
  surahStart: number;
  ayahStart: number;
  surahEnd: number;
  ayahEnd: number;
  ayahCount: number;
};

// --- Session functions ---

export async function insertSession(
  db: D1Database,
  data: InsertSessionData,
): Promise<Session> {
  const result = await db
    .prepare(
      `INSERT INTO sessions (started_at, duration_seconds, surah_start, ayah_start, surah_end, ayah_end, ayah_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(
      data.startedAt,
      data.durationSeconds,
      data.surahStart,
      data.ayahStart,
      data.surahEnd,
      data.ayahEnd,
      data.ayahCount,
    )
    .first<SessionRow>();
  return mapRow(result!);
}

export async function getSessionById(
  db: D1Database,
  id: number,
): Promise<Session | null> {
  const row = await db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .bind(id)
    .first<SessionRow>();
  return row ? mapRow(row) : null;
}

export async function getLastSession(
  db: D1Database,
): Promise<Session | null> {
  const row = await db
    .prepare("SELECT * FROM sessions ORDER BY started_at DESC LIMIT 1")
    .first<SessionRow>();
  return row ? mapRow(row) : null;
}

export async function deleteSessionById(
  db: D1Database,
  id: number,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM sessions WHERE id = ?")
    .bind(id)
    .run();
  return result.meta.changes > 0;
}

export async function insertBatch(
  db: D1Database,
  sessions: InsertSessionData[],
): Promise<number> {
  if (sessions.length === 0) return 0;

  const statements = sessions.map((s) =>
    db
      .prepare(
        `INSERT INTO sessions (started_at, duration_seconds, surah_start, ayah_start, surah_end, ayah_end, ayah_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        s.startedAt,
        s.durationSeconds,
        s.surahStart,
        s.ayahStart,
        s.surahEnd,
        s.ayahEnd,
        s.ayahCount,
      ),
  );

  await db.batch(statements);
  return sessions.length;
}

export async function getHistory(
  db: D1Database,
  limit: number = 10,
): Promise<Session[]> {
  const { results } = await db
    .prepare("SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?")
    .bind(limit)
    .all<SessionRow>();
  return results.map(mapRow);
}

// --- Stats functions ---

export async function getGlobalStats(db: D1Database): Promise<GlobalStats> {
  const row = await db
    .prepare(
      `SELECT
        COALESCE(COUNT(*), 0) AS total_sessions,
        COALESCE(SUM(ayah_count), 0) AS total_ayahs,
        COALESCE(SUM(duration_seconds), 0) AS total_seconds,
        COALESCE(AVG(ayah_count), 0) AS avg_ayahs,
        COALESCE(AVG(duration_seconds), 0) AS avg_seconds
      FROM sessions`,
    )
    .first<{
      total_sessions: number;
      total_ayahs: number;
      total_seconds: number;
      avg_ayahs: number;
      avg_seconds: number;
    }>();

  return {
    totalSessions: row!.total_sessions,
    totalAyahs: row!.total_ayahs,
    totalSeconds: row!.total_seconds,
    avgAyahsPerSession: Math.round(row!.avg_ayahs),
    avgSecondsPerSession: Math.round(row!.avg_seconds),
  };
}

export async function getPeriodStats(
  db: D1Database,
  period: "week" | "month",
  tz: string,
): Promise<PeriodStats> {
  const today = getTodayInTimezone(tz);
  const bounds =
    period === "week" ? getWeekBounds(today) : getMonthBounds(today);

  const row = await db
    .prepare(
      `SELECT
        COALESCE(COUNT(*), 0) AS sessions,
        COALESCE(SUM(ayah_count), 0) AS ayahs,
        COALESCE(SUM(duration_seconds), 0) AS seconds
      FROM sessions
      WHERE substr(started_at, 1, 10) BETWEEN ? AND ?`,
    )
    .bind(bounds.start, bounds.end)
    .first<{ sessions: number; ayahs: number; seconds: number }>();

  return {
    sessions: row!.sessions,
    ayahs: row!.ayahs,
    seconds: row!.seconds,
  };
}

// --- Streak ---

export async function calculateStreak(
  db: D1Database,
  tz: string,
): Promise<StreakResult> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT substr(started_at, 1, 10) AS day
       FROM sessions
       ORDER BY day DESC`,
    )
    .all<{ day: string }>();

  if (results.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  const days = results.map((r) => r.day);
  const today = getTodayInTimezone(tz);
  const yesterday = addDays(today, -1);

  // Current streak: count consecutive days starting from today or yesterday
  let currentStreak = 0;
  if (days[0] === today || days[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < days.length; i++) {
      const expected = addDays(days[0], -i);
      if (days[i] === expected) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Best streak: traverse ascending, track max consecutive days
  const ascending = [...days].sort();
  let bestStreak = 1;
  let streak = 1;
  for (let i = 1; i < ascending.length; i++) {
    const expected = addDays(ascending[i - 1], 1);
    if (ascending[i] === expected) {
      streak++;
    } else {
      streak = 1;
    }
    if (streak > bestStreak) {
      bestStreak = streak;
    }
  }

  return { currentStreak, bestStreak };
}

// --- Config ---

export async function getConfig(
  db: D1Database,
  key: string,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM config WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row ? row.value : null;
}

export async function setConfig(
  db: D1Database,
  key: string,
  value: string,
): Promise<void> {
  await db
    .prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)")
    .bind(key, value)
    .run();
}

// --- Prayer cache ---

export async function getPrayerCache(
  db: D1Database,
  date: string,
): Promise<PrayerCacheRow | null> {
  const row = await db
    .prepare("SELECT * FROM prayer_cache WHERE date = ?")
    .bind(date)
    .first<PrayerCacheRow>();
  return row ?? null;
}

export async function setPrayerCache(
  db: D1Database,
  times: PrayerTimes,
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
         fetched_at = datetime('now')`,
    )
    .bind(
      times.date,
      times.fajr,
      times.dhuhr,
      times.asr,
      times.maghrib,
      times.isha,
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
  prayer: PrayerName,
): Promise<void> {
  if (!VALID_PRAYER_NAMES.has(prayer)) {
    throw new Error(`Invalid prayer name: ${prayer}`);
  }
  await db
    .prepare(`UPDATE prayer_cache SET ${prayer}_sent = 1 WHERE date = ?`)
    .bind(date)
    .run();
}
