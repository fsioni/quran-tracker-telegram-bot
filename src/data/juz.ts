import { TOTAL_PAGES } from "./pages";

/** Starting page of each juz (1-30) in the Madina Mushaf */
export const JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

/** Returns which juz (1-30) a given page belongs to */
export function getJuzForPage(page: number): number {
  for (let i = JUZ_START_PAGES.length - 1; i >= 0; i--) {
    if (page >= JUZ_START_PAGES[i]) {
      return i + 1;
    }
  }
  return 1;
}

/** Returns the last page of the given juz */
export function getJuzEndPage(juz: number): number {
  if (juz >= 30) {
    return TOTAL_PAGES;
  }
  return JUZ_START_PAGES[juz] - 1;
}
