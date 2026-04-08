import { addDays, getTodayInTimezone } from "./date-helpers";
import { mapRow } from "./sessions";
import {
  ADJ_PAGE_COUNT_SQL,
  HAS_SPEED_DATA_SQL,
  PAGE_SECONDS_SQL,
  PAGE_STATS_SQL,
} from "./sql-fragments";
import type {
  DailySpeedPoint,
  Session,
  SessionRow,
  SessionType,
  SpeedAverages,
  TypeSpeed,
} from "./types";

export async function get7DayTypeAvgSpeed(
  db: D1Database,
  type: SessionType,
  tz: string,
  excludeSessionId: number
): Promise<{ pagesPerHour: number | null; versesPerHour: number | null }> {
  const today = getTodayInTimezone(tz);
  const date7d = addDays(today, -(7 - 1));

  const row = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN ${HAS_SPEED_DATA_SQL}
            THEN ${ADJ_PAGE_COUNT_SQL} ELSE 0 END) AS total_pages,
        SUM(CASE WHEN ${HAS_SPEED_DATA_SQL}
            THEN duration_seconds ELSE 0 END) AS page_seconds,
        SUM(CASE WHEN duration_seconds IS NOT NULL THEN ayah_count ELSE 0 END) AS total_ayahs,
        SUM(duration_seconds) AS total_seconds
      FROM sessions
      WHERE type = ? AND started_at >= ? AND id != ?`
    )
    .bind(type, `${date7d} 00:00:00`, excludeSessionId)
    .first<{
      total_pages: number | null;
      page_seconds: number | null;
      total_ayahs: number | null;
      total_seconds: number | null;
    }>();

  const pageSeconds = row?.page_seconds ?? 0;
  const totalSeconds = row?.total_seconds ?? 0;

  return {
    pagesPerHour:
      pageSeconds > 0 ? (row?.total_pages ?? 0) / (pageSeconds / 3600) : null,
    versesPerHour:
      totalSeconds > 0 ? (row?.total_ayahs ?? 0) / (totalSeconds / 3600) : null,
  };
}

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
        SUM(CASE WHEN ${HAS_SPEED_DATA_SQL} THEN ${ADJ_PAGE_COUNT_SQL} ELSE 0 END) as total_pages,
        SUM(CASE WHEN ${HAS_SPEED_DATA_SQL} THEN duration_seconds ELSE 0 END) as total_seconds,
        SUM(CASE WHEN started_at >= ? AND ${HAS_SPEED_DATA_SQL} THEN ${ADJ_PAGE_COUNT_SQL} ELSE 0 END) as pages_7d,
        SUM(CASE WHEN started_at >= ? AND ${HAS_SPEED_DATA_SQL} THEN duration_seconds ELSE 0 END) as seconds_7d,
        SUM(CASE WHEN started_at >= ? AND ${HAS_SPEED_DATA_SQL} THEN ${ADJ_PAGE_COUNT_SQL} ELSE 0 END) as pages_30d,
        SUM(CASE WHEN started_at >= ? AND ${HAS_SPEED_DATA_SQL} THEN duration_seconds ELSE 0 END) as seconds_30d
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
       ORDER BY CAST(${ADJ_PAGE_COUNT_SQL} AS REAL) / duration_seconds DESC
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
       WHERE duration_seconds IS NOT NULL
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
        SUM(CASE WHEN ${HAS_SPEED_DATA_SQL} THEN duration_seconds ELSE 0 END) as total_seconds,
        SUM(CASE WHEN ${HAS_SPEED_DATA_SQL} THEN ${ADJ_PAGE_COUNT_SQL} ELSE 0 END) as total_pages,
        SUM(CASE WHEN ${HAS_SPEED_DATA_SQL} THEN 1 ELSE 0 END) as session_count
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

export async function getDailySpeedData(
  db: D1Database,
  today: string,
  days: number
): Promise<DailySpeedPoint[]> {
  const startDate = addDays(today, -(days - 1));
  const { results } = await db
    .prepare(
      `SELECT
        substr(started_at, 1, 10) AS day,
        ${PAGE_STATS_SQL} AS total_pages,
        ${PAGE_SECONDS_SQL} AS total_seconds
      FROM sessions
      WHERE substr(started_at, 1, 10) >= ?
      GROUP BY substr(started_at, 1, 10)
      HAVING total_pages > 0 AND total_seconds > 0
      ORDER BY day ASC`
    )
    .bind(startDate)
    .all<{ day: string; total_pages: number; total_seconds: number }>();

  return results.map((r) => ({
    day: r.day,
    pages: r.total_pages,
    speed: r.total_pages / (r.total_seconds / 3600),
  }));
}
