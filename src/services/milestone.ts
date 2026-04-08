import { getJuzEndPage, getJuzForPage } from "../data/juz";
import { TOTAL_PAGES } from "../data/pages";
import { getSurah } from "../data/surahs";
import type { Locale } from "../locales/types";
import { getSurahName } from "./format";

export interface MilestoneInput {
  ayahEnd: number;
  pageEnd?: number | null;
  surahEnd: number;
}

export function getMilestoneText(
  input: MilestoneInput,
  t: Locale
): string | null {
  // Priority 1: Surah completion (past halfway)
  const surah = getSurah(input.surahEnd);
  if (surah) {
    const remaining = surah.ayahCount - input.ayahEnd;
    if (remaining > 0 && input.ayahEnd > surah.ayahCount / 2) {
      return t.milestone.surahRemaining(
        remaining,
        getSurahName(input.surahEnd, t)
      );
    }
  }

  if (input.pageEnd == null) {
    return null;
  }

  // Priority 2: Juz completion (within 10 pages)
  const juz = getJuzForPage(input.pageEnd);
  const juzEnd = getJuzEndPage(juz);
  const juzRemaining = juzEnd - input.pageEnd;
  if (juzRemaining > 0 && juzRemaining <= 10) {
    return t.milestone.juzRemaining(juzRemaining, juz);
  }

  // Priority 3: Khatma completion (past page 550)
  const khatmaRemaining = TOTAL_PAGES - input.pageEnd;
  if (khatmaRemaining > 0 && input.pageEnd >= 550) {
    return t.milestone.khatmaRemaining(khatmaRemaining);
  }

  return null;
}
