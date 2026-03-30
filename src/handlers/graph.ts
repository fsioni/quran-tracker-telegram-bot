// src/handlers/graph.ts
import type { CustomContext } from "../bot";
import { buildSpeedChartUrl, computeMovingAverage } from "../services/chart";
import {
  getDailySpeedData,
  getTimezone,
  getTodayInTimezone,
} from "../services/db";

const DEFAULT_DAYS = 30;
const MIN_DAYS = 7;
const MAX_DAYS = 180;

export async function graphHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;

  // Parse optional days argument
  const input = ((ctx.match as string) || "").trim();
  let days = DEFAULT_DAYS;
  if (input !== "") {
    const parsed = Number.parseInt(input, 10);
    if (!Number.isNaN(parsed)) {
      days = Math.max(MIN_DAYS, Math.min(MAX_DAYS, parsed));
    }
  }

  const tz = await getTimezone(ctx.db);
  const today = getTodayInTimezone(tz);
  const data = await getDailySpeedData(ctx.db, today, days);

  if (data.length === 0) {
    await ctx.reply(t.graph.noData);
    return;
  }

  const labels = data.map((d) =>
    t.fmt.dateShort(d.day.slice(8, 10), d.day.slice(5, 7))
  );
  const speeds = data.map((d) => Math.round(d.speed * 10) / 10);
  const movingAvg = computeMovingAverage(speeds, 7);

  const url = buildSpeedChartUrl(
    labels,
    speeds,
    movingAvg,
    t.graph.title(days),
    t.graph.dailyLabel,
    t.graph.trendLabel,
    t.stats.pagesPerHourShort
  );

  try {
    await ctx.replyWithPhoto(url);
  } catch {
    await ctx.reply(t.graph.error);
  }
}
