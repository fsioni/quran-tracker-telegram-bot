import { err, ok, type Result } from "../../types";
import { addDays, getTodayInTimezone, getWeekBounds } from "./date-helpers";
import { mapRow } from "./sessions";
import type { Session, SessionRow } from "./types";

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

export function calculateKahfPagesRead(sessions: Session[]): number {
  return sessions.reduce((sum, s) => {
    if (s.pageStart !== null && s.pageEnd !== null) {
      return sum + (s.pageEnd - s.pageStart + 1);
    }
    return sum;
  }, 0);
}
