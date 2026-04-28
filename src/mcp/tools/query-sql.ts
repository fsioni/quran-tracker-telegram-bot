import { z } from "zod";
import { executeSelect } from "../sql/execute";
import { validateSql } from "../sql/validator";

export const QuerySqlParams = z.object({
  sql: z.string().min(1).max(8000),
});

export async function querySqlTool(input: {
  db: D1Database;
  params: z.infer<typeof QuerySqlParams>;
}) {
  const validated = validateSql(input.params.sql);
  if (!validated.ok) throw validated.error;
  const result = await executeSelect(input.db, validated.value.normalizedSql);
  return { ...result, truncated: validated.value.injectedLimit };
}
