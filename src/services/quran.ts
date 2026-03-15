import { Result, ok, err } from "../types";
import { getSurah, SURAHS, Surah } from "../data/surahs";

export function validateSurah(surahNum: number): Result<Surah> {
  if (!Number.isInteger(surahNum) || surahNum < 1 || surahNum > 114) {
    return err(`la sourate ${surahNum} n'existe pas (1-114)`);
  }
  const surah = getSurah(surahNum);
  if (!surah) {
    return err(`la sourate ${surahNum} n'existe pas (1-114)`);
  }
  return ok(surah);
}

export function validateAyah(surahNum: number, ayah: number): Result<true> {
  const surahResult = validateSurah(surahNum);
  if (!surahResult.ok) {
    return surahResult;
  }
  const surah = surahResult.value;
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > surah.ayahCount) {
    return err(
      `la sourate ${surahNum} n'a que ${surah.ayahCount} versets (verset ${ayah} demande)`,
    );
  }
  return ok(true);
}

export function validateRange(
  surahStart: number,
  ayahStart: number,
  surahEnd: number,
  ayahEnd: number,
): Result<true> {
  const startSurahResult = validateAyah(surahStart, ayahStart);
  if (!startSurahResult.ok) {
    return startSurahResult;
  }

  const endSurahResult = validateAyah(surahEnd, ayahEnd);
  if (!endSurahResult.ok) {
    return endSurahResult;
  }

  if (surahStart === surahEnd && ayahStart > ayahEnd) {
    return err(
      `la fin (${surahEnd}:${ayahEnd}) precede le debut (${surahStart}:${ayahStart})`,
    );
  }

  if (surahStart > surahEnd) {
    return err(
      `la fin (${surahEnd}:${ayahEnd}) precede le debut (${surahStart}:${ayahStart})`,
    );
  }

  return ok(true);
}

export function getCompletedSurahs(
  surahStart: number,
  ayahStart: number,
  surahEnd: number,
  ayahEnd: number,
): Surah[] {
  const completed: Surah[] = [];

  for (let s = surahStart; s <= surahEnd; s++) {
    const surah = SURAHS[s - 1];
    const startsAtBeginning = s === surahStart ? ayahStart === 1 : true;
    const endsAtEnd = s === surahEnd ? ayahEnd === surah.ayahCount : true;

    if (startsAtBeginning && endsAtEnd) {
      completed.push(surah);
    }
  }

  return completed;
}

export function calculateAyahCount(
  surahStart: number,
  ayahStart: number,
  surahEnd: number,
  ayahEnd: number,
): number {
  if (surahStart === surahEnd) {
    return ayahEnd - ayahStart + 1;
  }

  const startSurah = getSurah(surahStart)!;
  const remainingInStart = startSurah.ayahCount - ayahStart + 1;

  let middleAyahs = 0;
  for (let s = surahStart + 1; s < surahEnd; s++) {
    middleAyahs += SURAHS[s - 1].ayahCount;
  }

  return remainingInStart + middleAyahs + ayahEnd;
}
