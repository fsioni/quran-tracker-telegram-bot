import { z } from "zod";
import { getRecentPageStats } from "../../services/db/stats";

export const GetRecentSpeedParams = z.object({
  days: z.number().int().min(1).max(365).optional().default(7),
});

export async function getRecentSpeedTool(input: {
  db: D1Database;
  tz: string;
  params: z.infer<typeof GetRecentSpeedParams>;
}) {
  return await getRecentPageStats(input.db, input.tz, input.params.days);
}
