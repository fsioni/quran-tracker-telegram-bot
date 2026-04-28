import { McpError } from "../errors";

export interface SelectResult {
  columns: string[];
  rowCount: number;
  rows: unknown[][];
}

const DEFAULT_TIMEOUT_MS = 10_000;

export async function executeSelect(
  db: D1Database,
  sql: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<SelectResult> {
  const stmt = db.prepare(sql);
  const queryPromise = stmt.all();
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(new McpError("SQL_TIMEOUT", `Query exceeded ${timeoutMs}ms.`)),
      timeoutMs
    );
  });

  let result: { results: Record<string, unknown>[] };
  try {
    result = await Promise.race([queryPromise, timeoutPromise]);
  } catch (e) {
    if (e instanceof McpError) {
      throw e;
    }
    throw new McpError(
      "DB_ERROR",
      `Query failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const rows = (result as { results: Record<string, unknown>[] }).results;
  if (rows.length === 0) {
    return { columns: [], rows: [], rowCount: 0 };
  }
  const columns = Object.keys(rows[0]);
  const data = rows.map((r) => columns.map((c) => r[c]));
  return { columns, rows: data, rowCount: rows.length };
}
