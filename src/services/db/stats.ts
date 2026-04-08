import { err, ok, type Result } from "../../types";
import {
  addDays,
  getMonthBounds,
  getTodayInTimezone,
  getWeekBounds,
} from "./date-helpers";
import { mapRow } from "./sessions";
import {
  ADJ_PAGE_COUNT_SQL,
  PAGE_SECONDS_SQL,
  PAGE_STATS_SQL,
} from "./sql-fragments";
import type {
  GlobalStats,
  PeriodStats,
  Session,
  SessionRow,
  SessionType,
  StreakResult,
} from "./types";

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
        COALESCE(AVG(duration_seconds), 0) AS avg_seconds,
        ${PAGE_STATS_SQL} AS total_pages,
        ${PAGE_SECONDS_SQL} AS total_page_seconds
      FROM sessions WHERE type = ?`
    : `SELECT
        COALESCE(COUNT(*), 0) AS total_sessions,
        COALESCE(SUM(ayah_count), 0) AS total_ayahs,
        COALESCE(SUM(duration_seconds), 0) AS total_seconds,
        COALESCE(AVG(ayah_count), 0) AS avg_ayahs,
        COALESCE(AVG(duration_seconds), 0) AS avg_seconds,
        ${PAGE_STATS_SQL} AS total_pages,
        ${PAGE_SECONDS_SQL} AS total_page_seconds
      FROM sessions`;
  const stmt = type ? db.prepare(query).bind(type) : db.prepare(query);
  const row = await stmt.first<{
    total_sessions: number;
    total_ayahs: number;
    total_seconds: number;
    avg_ayahs: number;
    avg_seconds: number;
    total_pages: number;
    total_page_seconds: number;
  }>();

  if (!row) {
    return err("getGlobalStats: D1 returned no row for aggregate query");
  }
  return ok({
    totalSessions: row.total_sessions,
    totalAyahs: row.total_ayahs,
    totalPageSeconds: row.total_page_seconds,
    totalPages: row.total_pages,
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
        COALESCE(SUM(duration_seconds), 0) AS seconds,
        ${PAGE_STATS_SQL} AS pages,
        ${PAGE_SECONDS_SQL} AS page_seconds
      FROM sessions
      WHERE substr(started_at, 1, 10) BETWEEN ? AND ?`
    )
    .bind(bounds.start, bounds.end)
    .first<{
      sessions: number;
      ayahs: number;
      seconds: number;
      pages: number;
      page_seconds: number;
    }>();

  if (!row) {
    return err("getPeriodStats: D1 returned no row for aggregate query");
  }
  return ok({
    sessions: row.sessions,
    ayahs: row.ayahs,
    seconds: row.seconds,
    pages: row.pages,
    pageSeconds: row.page_seconds,
  });
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
          COALESCE(SUM(duration_seconds), 0) AS seconds,
          ${PAGE_STATS_SQL} AS pages,
          ${PAGE_SECONDS_SQL} AS page_seconds
        FROM sessions
        WHERE substr(started_at, 1, 10) BETWEEN ? AND ?`
      )
      .bind(start, end)
      .first<{
        sessions: number;
        ayahs: number;
        seconds: number;
        pages: number;
        page_seconds: number;
      }>();

    if (!row) {
      return err("getPreviousWeekStats: D1 returned no row");
    }
    return ok({
      sessions: row.sessions,
      ayahs: row.ayahs,
      seconds: row.seconds,
      pages: row.pages,
      pageSeconds: row.page_seconds,
    });
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
      `SELECT COALESCE(SUM(${ADJ_PAGE_COUNT_SQL}), 0) AS total_pages
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

export async function getRecentPace(
  db: D1Database,
  tz: string,
  days = 14
): Promise<number> {
  const today = getTodayInTimezone(tz);
  const startDate = addDays(today, -(days - 1));
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(${ADJ_PAGE_COUNT_SQL}), 0) AS total_pages
       FROM sessions
       WHERE type = 'normal'
         AND page_start IS NOT NULL
         AND page_end IS NOT NULL
         AND started_at >= ?`
    )
    .bind(`${startDate} 00:00:00`)
    .first<{ total_pages: number }>();
  if (!row || row.total_pages === 0) {
    return 0;
  }

  return row.total_pages / days;
}
