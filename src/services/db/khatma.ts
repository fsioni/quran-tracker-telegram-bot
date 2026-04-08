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

export async function getKhatmaElapsedSeconds(db: D1Database): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds
       FROM sessions
       WHERE type = 'normal'
         AND started_at > COALESCE(
           (SELECT completed_at FROM khatmas ORDER BY completed_at DESC LIMIT 1),
           '1970-01-01'
         )`
    )
    .first<{ total_seconds: number }>();
  return row?.total_seconds ?? 0;
}

export async function getKhatmaCount(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM khatmas")
    .first<{ count: number }>();
  return row?.count ?? 0;
}
