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
