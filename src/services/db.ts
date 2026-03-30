import { DEFAULT_TZ } from "../config";
import { err, ok, type Result } from "../types";

// --- Row types (D1 snake_case) ---

export type SessionType = "normal" | "extra" | "kahf";

interface SessionRow {
  ayah_count: number;
  ayah_end: number;
  ayah_start: number;
  created_at: string;
  duration_seconds: number;
  id: number;
  page_end: number | null;
  page_start: number | null;
  started_at: string;
  surah_end: number;
  surah_start: number;
  type: string;
}

// --- Public types (camelCase) ---

export interface Session {
  ayahCount: number;
  ayahEnd: number;
  ayahStart: number;
  createdAt: string;
  durationSeconds: number;
  id: number;
  pageEnd: number | null;
  pageStart: number | null;
  startedAt: string;
  surahEnd: number;
  surahStart: number;
  type: SessionType;
}

export interface GlobalStats {
  avgAyahsPerSession: number;
  avgSecondsPerSession: number;
  totalAyahs: number;
  totalSeconds: number;
  totalSessions: number;
}

export interface PeriodStats {
  ayahs: number;
  seconds: number;
  sessions: number;
}

export interface StreakResult {
  bestStreak: number;
  currentStreak: number;
}

export interface SpeedAverages {
  global: number | null;
  last7Days: number | null;
  last30Days: number | null;
}

export interface TypeSpeed {
  avgSpeed: number;
  sessionCount: number;
  type: SessionType;
}

export interface PrayerTimes {
  asr: string;
  date: string;
  dhuhr: string;
  fajr: string;
  isha: string;
  maghrib: string;
}

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
    pageStart: row.page_start,
    pageEnd: row.page_end,
    surahStart: row.surah_start,
    ayahStart: row.ayah_start,
    surahEnd: row.surah_end,
    ayahEnd: row.ayah_end,
    ayahCount: row.ayah_count,
    type: row.type as SessionType,
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

export function getNowTimestamp(tz: string): string {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: tz })
    .replace("T", " ")
    .slice(0, 19);
}

export async function getTimezone(db: D1Database): Promise<string> {
  return (await getConfig(db, "timezone")) ?? DEFAULT_TZ;
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekBounds(today: string): { start: string; end: string } {
  const d = new Date(`${today}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sunday
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const start = addDays(today, diffToMonday);
  const end = addDays(start, 6);
  return { start, end };
}

export function getMonthBounds(today: string): { start: string; end: string } {
  const d = new Date(`${today}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-based
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

// --- Session data param ---

export interface InsertSessionData {
  ayahCount: number;
  ayahEnd: number;
  ayahStart: number;
  durationSeconds: number;
  pageEnd?: number;
  pageStart?: number;
  startedAt: string;
  surahEnd: number;
  surahStart: number;
  type?: SessionType;
}

// --- Session functions ---

export async function insertSession(
  db: D1Database,
  data: InsertSessionData
): Promise<Result<Session>> {
  const result = await db
    .prepare(
      `INSERT INTO sessions (started_at, duration_seconds, surah_start, ayah_start, surah_end, ayah_end, ayah_count, type, page_start, page_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(
      data.startedAt,
      data.durationSeconds,
      data.surahStart,
      data.ayahStart,
      data.surahEnd,
      data.ayahEnd,
      data.ayahCount,
      data.type ?? "normal",
      data.pageStart ?? null,
      data.pageEnd ?? null
    )
    .first<SessionRow>();
  if (!result) {
    return err("insertSession: D1 returned no row after INSERT");
  }
  return ok(mapRow(result));
}

export async function getSessionById(
  db: D1Database,
  id: number
): Promise<Session | null> {
  const row = await db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .bind(id)
    .first<SessionRow>();
  return row ? mapRow(row) : null;
}

export async function getLastSession(
  db: D1Database,
  type?: SessionType
): Promise<Session | null> {
  const query = type
    ? "SELECT * FROM sessions WHERE type = ? ORDER BY started_at DESC LIMIT 1"
    : "SELECT * FROM sessions ORDER BY started_at DESC LIMIT 1";
  const stmt = type ? db.prepare(query).bind(type) : db.prepare(query);
  const row = await stmt.first<SessionRow>();
  return row ? mapRow(row) : null;
}

export async function deleteSessionById(
  db: D1Database,
  id: number
): Promise<Session | null> {
  const row = await db
    .prepare("DELETE FROM sessions WHERE id = ? RETURNING *")
    .bind(id)
    .first<SessionRow>();
  return row ? mapRow(row) : null;
}

export async function insertBatch(
  db: D1Database,
  sessions: InsertSessionData[]
): Promise<number> {
  if (sessions.length === 0) {
    return 0;
  }

  const statements = sessions.map((s) =>
    db
      .prepare(
        `INSERT INTO sessions (started_at, duration_seconds, surah_start, ayah_start, surah_end, ayah_end, ayah_count, type, page_start, page_end)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        s.startedAt,
        s.durationSeconds,
        s.surahStart,
        s.ayahStart,
        s.surahEnd,
        s.ayahEnd,
        s.ayahCount,
        s.type ?? "normal",
        s.pageStart ?? null,
        s.pageEnd ?? null
      )
  );

  await db.batch(statements);
  return sessions.length;
}

export async function getHistory(
  db: D1Database,
  limit = 10,
  type?: SessionType,
  offset = 0
): Promise<Session[]> {
  const query = type
    ? "SELECT * FROM sessions WHERE type = ? ORDER BY started_at DESC LIMIT ? OFFSET ?"
    : "SELECT * FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?";
  const stmt = type
    ? db.prepare(query).bind(type, limit, offset)
    : db.prepare(query).bind(limit, offset);
  const { results } = await stmt.all<SessionRow>();
  return results.map(mapRow);
}

export async function getSessionCount(
  db: D1Database,
  type?: SessionType
): Promise<number> {
  const query = type
    ? "SELECT COUNT(*) AS count FROM sessions WHERE type = ?"
    : "SELECT COUNT(*) AS count FROM sessions";
  const stmt = type ? db.prepare(query).bind(type) : db.prepare(query);
  const row = await stmt.first<{ count: number }>();
  return row?.count ?? 0;
}

// --- Kahf functions ---

export async function getKahfSessionsThisWeek(
  db: D1Database,
  tz: string
): Promise<Session[]> {
  const today = getTodayInTimezone(tz);
  const { start, end } = getWeekBounds(today);
  const { results } = await db
    .prepare(
      `SELECT * FROM sessions
       WHERE type = 'kahf' AND substr(started_at, 1, 10) BETWEEN ? AND ?
       ORDER BY started_at DESC`
    )
    .bind(start, end)
    .all<SessionRow>();
  return results.map(mapRow);
}

export async function getLastWeekKahfTotal(
  db: D1Database,
  tz: string
): Promise<Result<number>> {
  const today = getTodayInTimezone(tz);
  const lastWeekDay = addDays(today, -7);
  const { start, end } = getWeekBounds(lastWeekDay);
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(duration_seconds), 0) AS total
       FROM sessions
       WHERE type = 'kahf' AND substr(started_at, 1, 10) BETWEEN ? AND ?`
    )
    .bind(start, end)
    .first<{ total: number }>();
  if (!row) {
    return err("getLastWeekKahfTotal: D1 returned no row for aggregate query");
  }
  return ok(row.total);
}

export async function getKahfStats(db: D1Database): Promise<{
  lastDuration: number | null;
  lastDate: string | null;
}> {
  const row = await db
    .prepare(
      "SELECT duration_seconds, substr(started_at, 1, 10) as day FROM sessions WHERE type = 'kahf' ORDER BY started_at DESC LIMIT 1"
    )
    .first<{ duration_seconds: number; day: string }>();
  return {
    lastDuration: row?.duration_seconds ?? null,
    lastDate: row?.day ?? null,
  };
}

// --- Stats functions ---

export async function getGlobalStats(
  db: D1Database,
  type?: SessionType
): Promise<Result<GlobalStats>> {
  const query = type
    ? `SELECT
        COALESCE(COUNT(*), 0) AS total_sessions,
        COALESCE(SUM(ayah_count), 0) AS total_ayahs,
        COALESCE(SUM(duration_seconds), 0) AS total_seconds,
        COALESCE(AVG(ayah_count), 0) AS avg_ayahs,
        COALESCE(AVG(duration_seconds), 0) AS avg_seconds
      FROM sessions WHERE type = ?`
    : `SELECT
        COALESCE(COUNT(*), 0) AS total_sessions,
        COALESCE(SUM(ayah_count), 0) AS total_ayahs,
        COALESCE(SUM(duration_seconds), 0) AS total_seconds,
        COALESCE(AVG(ayah_count), 0) AS avg_ayahs,
        COALESCE(AVG(duration_seconds), 0) AS avg_seconds
      FROM sessions`;
  const stmt = type ? db.prepare(query).bind(type) : db.prepare(query);
  const row = await stmt.first<{
    total_sessions: number;
    total_ayahs: number;
    total_seconds: number;
    avg_ayahs: number;
    avg_seconds: number;
  }>();

  if (!row) {
    return err("getGlobalStats: D1 returned no row for aggregate query");
  }
  return ok({
    totalSessions: row.total_sessions,
    totalAyahs: row.total_ayahs,
    totalSeconds: row.total_seconds,
    avgAyahsPerSession: Math.round(row.avg_ayahs),
    avgSecondsPerSession: Math.round(row.avg_seconds),
  });
}

export const getStatsByType = getGlobalStats;

export async function getPeriodStats(
  db: D1Database,
  period: "week" | "month",
  tz: string,
  weekOffset = 0
): Promise<Result<PeriodStats>> {
  const today = getTodayInTimezone(tz);
  const baseDay =
    period === "week" && weekOffset > 0
      ? addDays(today, -7 * weekOffset)
      : today;
  const bounds =
    period === "week" ? getWeekBounds(baseDay) : getMonthBounds(today);

  const row = await db
    .prepare(
      `SELECT
        COALESCE(COUNT(*), 0) AS sessions,
        COALESCE(SUM(ayah_count), 0) AS ayahs,
        COALESCE(SUM(duration_seconds), 0) AS seconds
      FROM sessions
      WHERE substr(started_at, 1, 10) BETWEEN ? AND ?`
    )
    .bind(bounds.start, bounds.end)
    .first<{ sessions: number; ayahs: number; seconds: number }>();

  if (!row) {
    return err("getPeriodStats: D1 returned no row for aggregate query");
  }
  return ok(row);
}

export async function getPreviousWeekStats(
  db: D1Database,
  tz: string,
  todayOverride?: string
): Promise<Result<PeriodStats>> {
  const today = todayOverride ?? getTodayInTimezone(tz);
  const currentWeek = getWeekBounds(today);
  const start = addDays(currentWeek.start, -7);
  const end = addDays(currentWeek.start, -1);

  try {
    const row = await db
      .prepare(
        `SELECT
          COALESCE(COUNT(*), 0) AS sessions,
          COALESCE(SUM(ayah_count), 0) AS ayahs,
          COALESCE(SUM(duration_seconds), 0) AS seconds
        FROM sessions
        WHERE substr(started_at, 1, 10) BETWEEN ? AND ?`
      )
      .bind(start, end)
      .first<{ sessions: number; ayahs: number; seconds: number }>();

    if (!row) {
      return err("getPreviousWeekStats: D1 returned no row");
    }
    return ok(row);
  } catch (e) {
    return err(
      `getPreviousWeekStats: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export async function getWeekPages(
  db: D1Database,
  tz: string,
  weekOffset = 0
): Promise<Result<number>> {
  const today = getTodayInTimezone(tz);
  const baseDay = weekOffset > 0 ? addDays(today, -7 * weekOffset) : today;
  const { start, end } = getWeekBounds(baseDay);
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(page_end - page_start + 1), 0) AS total_pages
       FROM sessions
       WHERE page_start IS NOT NULL AND page_end IS NOT NULL
         AND substr(started_at, 1, 10) BETWEEN ? AND ?`
    )
    .bind(start, end)
    .first<{ total_pages: number }>();
  if (!row) {
    return err("getWeekPages: D1 returned no row for aggregate query");
  }
  return ok(row.total_pages);
}

export async function getWeekSessions(
  db: D1Database,
  tz: string
): Promise<Session[]> {
  const today = getTodayInTimezone(tz);
  const { start, end } = getWeekBounds(today);
  const { results } = await db
    .prepare(
      `SELECT * FROM sessions
       WHERE substr(started_at, 1, 10) BETWEEN ? AND ?
       ORDER BY started_at`
    )
    .bind(start, end)
    .all<SessionRow>();
  return results.map(mapRow);
}

// --- Streak ---

export async function calculateStreak(
  db: D1Database,
  tz: string
): Promise<StreakResult> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT substr(started_at, 1, 10) AS day
       FROM sessions
       ORDER BY day DESC`
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

// --- Pace ---

function diffDays(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export async function getRecentPace(
  db: D1Database,
  tz: string,
  days = 14
): Promise<number> {
  const today = getTodayInTimezone(tz);
  const startDate = addDays(today, -(days - 1));
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(page_end - page_start + 1), 0) AS total_pages,
              MIN(started_at) AS first_started_at
       FROM sessions
       WHERE type = 'normal'
         AND page_start IS NOT NULL
         AND page_end IS NOT NULL
         AND started_at >= ?`
    )
    .bind(`${startDate} 00:00:00`)
    .first<{ total_pages: number; first_started_at: string | null }>();
  if (!row || row.total_pages === 0) {
    return 0;
  }

  const firstDate = row.first_started_at?.slice(0, 10);
  if (!firstDate) {
    return 0;
  }
  const effectiveDays = diffDays(firstDate, today) + 1;
  return row.total_pages / Math.min(days, effectiveDays);
}

// --- Speed functions ---

export async function getSpeedAverages(
  db: D1Database,
  tz: string
): Promise<SpeedAverages> {
  const today = getTodayInTimezone(tz);
  const date7d = addDays(today, -(7 - 1));
  const date30d = addDays(today, -(30 - 1));

  const row = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN page_start IS NOT NULL AND page_end IS NOT NULL THEN page_end - page_start + 1 ELSE 0 END) as total_pages,
        SUM(CASE WHEN page_start IS NOT NULL AND page_end IS NOT NULL THEN duration_seconds ELSE 0 END) as total_seconds,
        SUM(CASE WHEN started_at >= ? AND page_start IS NOT NULL AND page_end IS NOT NULL THEN page_end - page_start + 1 ELSE 0 END) as pages_7d,
        SUM(CASE WHEN started_at >= ? AND page_start IS NOT NULL AND page_end IS NOT NULL THEN duration_seconds ELSE 0 END) as seconds_7d,
        SUM(CASE WHEN started_at >= ? AND page_start IS NOT NULL AND page_end IS NOT NULL THEN page_end - page_start + 1 ELSE 0 END) as pages_30d,
        SUM(CASE WHEN started_at >= ? AND page_start IS NOT NULL AND page_end IS NOT NULL THEN duration_seconds ELSE 0 END) as seconds_30d
      FROM sessions`
    )
    .bind(
      `${date7d} 00:00:00`,
      `${date7d} 00:00:00`,
      `${date30d} 00:00:00`,
      `${date30d} 00:00:00`
    )
    .first<{
      total_pages: number | null;
      total_seconds: number | null;
      pages_7d: number | null;
      seconds_7d: number | null;
      pages_30d: number | null;
      seconds_30d: number | null;
    }>();

  if (!row?.total_seconds) {
    return { global: null, last7Days: null, last30Days: null };
  }

  const totalPages = row.total_pages ?? 0;
  const global = totalPages / (row.total_seconds / 3600);
  const seconds7d = row.seconds_7d ?? 0;
  const last7Days =
    seconds7d > 0 ? (row.pages_7d ?? 0) / (seconds7d / 3600) : null;
  const seconds30d = row.seconds_30d ?? 0;
  const last30Days =
    seconds30d > 0 ? (row.pages_30d ?? 0) / (seconds30d / 3600) : null;

  return { global, last7Days, last30Days };
}

export async function getBestSpeedSession(
  db: D1Database
): Promise<Session | null> {
  const row = await db
    .prepare(
      `SELECT * FROM sessions
       WHERE duration_seconds >= 60
         AND page_start IS NOT NULL
         AND page_end IS NOT NULL
       ORDER BY CAST(page_end - page_start + 1 AS REAL) / duration_seconds DESC
       LIMIT 1`
    )
    .first<SessionRow>();
  return row ? mapRow(row) : null;
}

export async function getLongestSession(
  db: D1Database
): Promise<Session | null> {
  const row = await db
    .prepare(
      `SELECT * FROM sessions
       ORDER BY duration_seconds DESC
       LIMIT 1`
    )
    .first<SessionRow>();
  return row ? mapRow(row) : null;
}

export async function getSpeedByType(db: D1Database): Promise<TypeSpeed[]> {
  const { results } = await db
    .prepare(
      `SELECT type,
        SUM(CASE WHEN page_start IS NOT NULL AND page_end IS NOT NULL THEN duration_seconds ELSE 0 END) as total_seconds,
        SUM(CASE WHEN page_start IS NOT NULL AND page_end IS NOT NULL THEN page_end - page_start + 1 ELSE 0 END) as total_pages,
        SUM(CASE WHEN page_start IS NOT NULL AND page_end IS NOT NULL THEN 1 ELSE 0 END) as session_count
      FROM sessions
      GROUP BY type`
    )
    .all<{
      type: string;
      total_seconds: number;
      total_pages: number;
      session_count: number;
    }>();

  return results
    .filter((r) => r.total_seconds > 0)
    .map((r) => ({
      type: r.type as SessionType,
      avgSpeed: r.total_pages / (r.total_seconds / 3600),
      sessionCount: r.session_count,
    }));
}

// --- Timer state ---

export type TimerType =
  | "normal_page"
  | "normal_verse"
  | "extra_page"
  | "extra_verse"
  | "kahf";

export interface TimerState {
  args: string;
  awaitingResponse: boolean;
  durationSeconds?: number;
  startedAt: string;
  startedEpoch: number;
  type: TimerType;
}

const TIMER_CONFIG_KEY = "timer_state";

export async function getTimerState(
  db: D1Database
): Promise<TimerState | null> {
  const raw = await getConfig(db, TIMER_CONFIG_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as TimerState;
  } catch {
    console.error("getTimerState: corrupted timer state, clearing");
    await db
      .prepare("DELETE FROM config WHERE key = ?")
      .bind(TIMER_CONFIG_KEY)
      .run();
    return null;
  }
}

export async function setTimerState(
  db: D1Database,
  state: TimerState
): Promise<void> {
  await setConfig(db, TIMER_CONFIG_KEY, JSON.stringify(state));
}

export async function clearTimerState(db: D1Database): Promise<void> {
  await db
    .prepare("DELETE FROM config WHERE key = ?")
    .bind(TIMER_CONFIG_KEY)
    .run();
}

// --- Kahf helpers ---

export function calculateKahfPagesRead(sessions: Session[]): number {
  return sessions.reduce((sum, s) => {
    if (s.pageStart !== null && s.pageEnd !== null) {
      return sum + (s.pageEnd - s.pageStart + 1);
    }
    return sum;
  }, 0);
}

// --- Config ---

export async function getConfig(
  db: D1Database,
  key: string
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
  value: string
): Promise<void> {
  await db
    .prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)")
    .bind(key, value)
    .run();
}

// --- Prayer cache ---

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

// --- Khatma functions ---

export async function insertKhatma(
  db: D1Database,
  completedAt: string
): Promise<{ id: number; completedAt: string }> {
  const row = await db
    .prepare("INSERT INTO khatmas (completed_at) VALUES (?) RETURNING *")
    .bind(completedAt)
    .first<{ id: number; completed_at: string }>();
  if (!row) {
    throw new Error("insertKhatma: no row returned");
  }
  return { id: row.id, completedAt: row.completed_at };
}

export async function getKhatmaCount(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM khatmas")
    .first<{ count: number }>();
  return row?.count ?? 0;
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
