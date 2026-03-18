import { getPeriodStats, getWeekPages, getWeekSessions, calculateStreak } from "./db";
import { getCompletedSurahs } from "./quran";
import type { PeriodStats, StreakResult } from "./db";
import type { Surah } from "../data/surahs";

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
  tz: string,
): Promise<WeeklyRecapData> {
  const [
    thisWeekResult,
    lastWeekResult,
    thisWeekPages,
    lastWeekPages,
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

  const thisWeek = thisWeekResult.ok
    ? thisWeekResult.value
    : { sessions: 0, ayahs: 0, seconds: 0 };
  const lastWeek = lastWeekResult.ok
    ? lastWeekResult.value
    : { sessions: 0, ayahs: 0, seconds: 0 };

  const surahSet = new Map<number, Surah>();
  for (const s of weekSessions) {
    const completed = getCompletedSurahs(s.surahStart, s.ayahStart, s.surahEnd, s.ayahEnd);
    for (const surah of completed) {
      surahSet.set(surah.number, surah);
    }
  }

  return {
    thisWeek,
    lastWeek,
    thisWeekPages,
    lastWeekPages,
    streak,
    completedSurahs: [...surahSet.values()],
  };
}
