// src/handlers/graph.ts
import type { CustomContext } from "../bot";
import {
  buildPagesChartUrl,
  buildSpeedChartUrl,
  computeMovingAverage,
} from "../services/chart";
import {
  addDays,
  getTimezone,
  getTodayInTimezone,
} from "../services/db/date-helpers";
import { getDailySpeedData } from "../services/db/speed";
import type { DailySpeedPoint } from "../services/db/types";

const DEFAULT_DAYS = 30;
const MIN_DAYS = 7;
const MAX_DAYS = 180;
const MOVING_AVG_WINDOW = 7;

const round1 = (v: number | null) =>
  v === null ? null : Math.round(v * 10) / 10;

/** Fill calendar gaps so the moving average is truly calendar-based. */
function fillDateGaps(data: DailySpeedPoint[]): {
  days: string[];
  speeds: (number | null)[];
  pages: (number | null)[];
} {
  if (data.length === 0) {
    return { days: [], speeds: [], pages: [] };
  }
  const dataMap = new Map(data.map((d) => [d.day, d]));
  const days: string[] = [];
  const speeds: (number | null)[] = [];
  const pages: (number | null)[] = [];
  const last = data.at(-1) as DailySpeedPoint;
  let current = data[0].day;
  const end = last.day;
  while (current <= end) {
    const point = dataMap.get(current);
    days.push(current);
    speeds.push(point?.speed ?? null);
    pages.push(point?.pages ?? null);
    current = addDays(current, 1);
  }
  return { days, speeds, pages };
}

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

  const filled = fillDateGaps(data);
  const labels = filled.days.map((d) =>
    t.fmt.dateShort(d.slice(8, 10), d.slice(5, 7))
  );
  const speeds = filled.speeds.map(round1);
  const movingAvg = computeMovingAverage(speeds, MOVING_AVG_WINDOW);

  const speedUrl = buildSpeedChartUrl(
    labels,
    speeds,
    movingAvg,
    t.graph.title(days),
    t.graph.dailyLabel,
    t.graph.trendLabel,
    t.stats.pagesPerHourShort
  );

  const dailyPages = filled.pages.map(round1);
  const pagesMovingAvg = computeMovingAverage(dailyPages, MOVING_AVG_WINDOW);
  const pagesUrl = buildPagesChartUrl(
    labels,
    dailyPages,
    pagesMovingAvg,
    t.graph.pagesTitle(days),
    t.graph.dailyLabel,
    t.graph.trendLabel,
    t.graph.pagesYAxis
  );

  try {
    await ctx.replyWithPhoto(speedUrl);
    await ctx.replyWithPhoto(pagesUrl);
  } catch {
    await ctx.reply(t.graph.error);
  }
}
