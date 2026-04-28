import { z } from "zod";
import { mapRow } from "../../services/db/sessions";
import type { SessionRow } from "../../services/db/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const GetSessionsParams = z.object({
  from: z.string().regex(ISO_DATE, "from must be YYYY-MM-DD"),
  to: z.string().regex(ISO_DATE, "to must be YYYY-MM-DD"),
  type: z.enum(["normal", "kahf", "extra"]).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(200)
    .transform((v) => Math.min(v, 200)),
});

export async function getSessionsTool(input: {
  db: D1Database;
  params: z.infer<typeof GetSessionsParams>;
}) {
  const { from, to, type, limit } = input.params;
  const sql = type
    ? `SELECT * FROM sessions
        WHERE substr(started_at, 1, 10) BETWEEN ? AND ?
          AND type = ?
        ORDER BY started_at DESC
        LIMIT ?`
    : `SELECT * FROM sessions
        WHERE substr(started_at, 1, 10) BETWEEN ? AND ?
        ORDER BY started_at DESC
        LIMIT ?`;
  const built = type
    ? input.db.prepare(sql).bind(from, to, type, limit)
    : input.db.prepare(sql).bind(from, to, limit);
  const { results } = await built.all<SessionRow>();
  return results.map(mapRow);
}
