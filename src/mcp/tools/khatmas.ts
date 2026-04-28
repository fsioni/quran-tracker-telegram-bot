export async function getKhatmasTool(input: { db: D1Database }) {
  const { results } = await input.db
    .prepare("SELECT id, completed_at FROM khatmas ORDER BY completed_at DESC")
    .all<{ id: number; completed_at: string }>();
  return results;
}
