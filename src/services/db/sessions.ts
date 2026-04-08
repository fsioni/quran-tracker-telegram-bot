import { err, ok, type Result } from "../../types";
import type {
  InsertSessionData,
  Session,
  SessionRow,
  SessionType,
} from "./types";

export function mapRow(row: SessionRow): Session {
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function insertSession(
  db: D1Database,
  data: InsertSessionData
): Promise<Result<Session>> {
  try {
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
  } catch (error) {
    return err(`insertSession: ${getErrorMessage(error)}`);
  }
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

export async function updateSessionDuration(
  db: D1Database,
  id: number,
  durationSeconds: number
): Promise<Session | null> {
  const row = await db
    .prepare(
      "UPDATE sessions SET duration_seconds = ? WHERE id = ? RETURNING *"
    )
    .bind(durationSeconds, id)
    .first<SessionRow>();
  return row ? mapRow(row) : null;
}

export async function insertBatch(
  db: D1Database,
  sessions: InsertSessionData[]
): Promise<Result<number>> {
  if (sessions.length === 0) {
    return ok(0);
  }

  try {
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
    return ok(sessions.length);
  } catch (error) {
    return err(`insertBatch: ${getErrorMessage(error)}`);
  }
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
