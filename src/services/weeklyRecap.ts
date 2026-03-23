import type { Surah } from "../data/surahs";
import type { Result } from "../types";
import { err, ok } from "../types";
import type { PeriodStats, StreakResult } from "./db";
import {
  calculateStreak,
  getPeriodStats,
  getWeekPages,
  getWeekSessions,
} from "./db";
import { getCompletedSurahs } from "./quran";

export type WeeklyRecapData = {
  thisWeek: PeriodStats;
  lastWeek: PeriodStats;
  thisWeekPages: number;
  lastWeekPages: number;
  streak: StreakResult;
  completedSurahs: Surah[];
};

export async function buildWeeklyRecap(
  db: D1Database,
  tz: string
): Promise<Result<WeeklyRecapData>> {
  const [
    thisWeekResult,
    lastWeekResult,
    thisWeekPagesResult,
    lastWeekPagesResult,
    streak,
    weekSessions,
  ] = await Promise.all([
    getPeriodStats(db, "week", tz, 0),
    getPeriodStats(db, "week", tz, 1),
    getWeekPages(db, tz, 0),
    getWeekPages(db, tz, 1),
    calculateStreak(db, tz),
    getWeekSessions(db, tz),
  ]);

  if (!thisWeekResult.ok) {
    return err(thisWeekResult.error);
  }
  if (!lastWeekResult.ok) {
    return err(lastWeekResult.error);
  }
  if (!thisWeekPagesResult.ok) {
    return err(thisWeekPagesResult.error);
  }
  if (!lastWeekPagesResult.ok) {
    return err(lastWeekPagesResult.error);
  }

  const surahSet = new Map<number, Surah>();
  for (const s of weekSessions) {
    const completed = getCompletedSurahs(
      s.surahStart,
      s.ayahStart,
      s.surahEnd,
      s.ayahEnd
    );
    for (const surah of completed) {
      surahSet.set(surah.number, surah);
    }
  }

  return ok({
    thisWeek: thisWeekResult.value,
    lastWeek: lastWeekResult.value,
    thisWeekPages: thisWeekPagesResult.value,
    lastWeekPages: lastWeekPagesResult.value,
    streak,
    completedSurahs: [...surahSet.values()],
  });
}
