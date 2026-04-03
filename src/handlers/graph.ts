// src/handlers/graph.ts
import type { CustomContext } from "../bot";
import {
  buildPageChartUrl,
  buildSpeedChartUrl,
  computeMovingAverage,
} from "../services/chart";
import {
  addDays,
  type DailySpeedPoint,
  getDailySpeedData,
  getTimezone,
  getTodayInTimezone,
} from "../services/db";

const DEFAULT_DAYS = 30;
const MIN_DAYS = 7;
const MAX_DAYS = 180;

/** Fill calendar gaps so charts are truly calendar-based. */
function fillDateGaps(data: DailySpeedPoint[]): {
  days: string[];
  pages: (number | null)[];
  speeds: (number | null)[];
} {
  if (data.length === 0) {
    return { days: [], pages: [], speeds: [] };
  }
  const speedMap = new Map(data.map((d) => [d.day, d.speed]));
  const pagesMap = new Map(data.map((d) => [d.day, d.pages]));
  const days: string[] = [];
  const speeds: (number | null)[] = [];
  const pages: (number | null)[] = [];
  const last = data.at(-1) as DailySpeedPoint;
  let current = data[0].day;
  const end = last.day;
  while (current <= end) {
    days.push(current);
    speeds.push(speedMap.get(current) ?? null);
    pages.push(pagesMap.get(current) ?? null);
    current = addDays(current, 1);
  }
  return { days, pages, speeds };
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
  const speeds = filled.speeds.map((s) =>
    s === null ? null : Math.round(s * 10) / 10
  );
  const dailyPages = filled.pages.map((p) =>
    p === null ? null : Math.round(p * 10) / 10
  );
  const speedMovingAvg = computeMovingAverage(speeds, 7);
  const pagesMovingAvg = computeMovingAverage(dailyPages, 7);

  const speedUrl = buildSpeedChartUrl(
    labels,
    speeds,
    speedMovingAvg,
    t.graph.title(days),
    t.graph.dailyLabel,
    t.graph.trendLabel,
    t.stats.pagesPerHourShort
  );

  const pagesUrl = buildPageChartUrl(
    labels,
    dailyPages,
    pagesMovingAvg,
    t.graph.pagesTitle(days),
    t.graph.pagesLabel,
    t.graph.trendLabel
  );

  try {
    await ctx.replyWithPhoto(speedUrl);
    await ctx.replyWithPhoto(pagesUrl);
  } catch {
    await ctx.reply(t.graph.error);
  }
}
