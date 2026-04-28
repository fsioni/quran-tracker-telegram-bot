import { z } from "zod";
import {
  calculateStreak,
  getGlobalStats,
  getPeriodStats,
} from "../../services/db/stats";
import { McpError } from "../errors";

const SessionTypeSchema = z.enum(["normal", "kahf"]).optional();

export const GetGlobalStatsParams = z.object({
  type: SessionTypeSchema,
});

export const GetPeriodStatsParams = z.object({
  period: z.enum(["week", "month"]),
  offset: z.number().int().min(0).max(120).optional().default(0),
});

export async function getGlobalStatsTool(input: {
  db: D1Database;
  params: z.infer<typeof GetGlobalStatsParams>;
}) {
  const r = await getGlobalStats(input.db, input.params.type);
  if (!r.ok) {
    throw new McpError("DB_ERROR", r.error);
  }
  return r.value;
}

export async function getPeriodStatsTool(input: {
  db: D1Database;
  tz: string;
  params: z.infer<typeof GetPeriodStatsParams>;
}) {
  const r = await getPeriodStats(
    input.db,
    input.params.period,
    input.tz,
    input.params.offset ?? 0
  );
  if (!r.ok) {
    throw new McpError("DB_ERROR", r.error);
  }
  return r.value;
}

export async function getStreakTool(input: { db: D1Database; tz: string }) {
  return await calculateStreak(input.db, input.tz);
}
