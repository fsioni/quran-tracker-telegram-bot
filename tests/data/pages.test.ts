import {
  getPageBoundary,
  getPageRange,
  KAHF_PAGE_END,
  KAHF_PAGE_START,
  KAHF_TOTAL_PAGES,
  PAGES,
} from "../../src/data/pages";
import { getSurah } from "../../src/data/surahs";

describe("PAGES data", () => {
  it("has exactly 604 entries", () => {
    expect(PAGES).toHaveLength(604);
  });

  it("page 1 starts at surah 1, ayah 1", () => {
    expect(PAGES[0]).toEqual({ page: 1, surah: 1, ayah: 1 });
  });

  it("page 2 starts at surah 2, ayah 1 (Al-Baqara)", () => {
    expect(PAGES[1]).toEqual({ page: 2, surah: 2, ayah: 1 });
  });

  it("last page (604) starts at surah 112", () => {
    expect(PAGES[603].page).toBe(604);
    expect(PAGES[603].surah).toBe(112);
  });

  it("pages are in ascending order", () => {
    for (let i = 0; i < PAGES.length; i++) {
      expect(PAGES[i].page).toBe(i + 1);
    }
  });

  it("each page starts at or after the previous page", () => {
    for (let i = 1; i < PAGES.length; i++) {
      const prev = PAGES[i - 1];
      const curr = PAGES[i];
      if (curr.surah === prev.surah) {
        expect(curr.ayah).toBeGreaterThan(prev.ayah);
      } else {
        expect(curr.surah).toBeGreaterThanOrEqual(prev.surah);
      }
    }
  });
});

describe("Al-Kahf constants", () => {
  it("KAHF_PAGE_START is 293", () => {
    expect(KAHF_PAGE_START).toBe(293);
  });

  it("KAHF_PAGE_END is 304", () => {
    expect(KAHF_PAGE_END).toBe(304);
  });

  it("KAHF_TOTAL_PAGES is 12", () => {
    expect(KAHF_TOTAL_PAGES).toBe(12);
    expect(KAHF_PAGE_END - KAHF_PAGE_START + 1).toBe(KAHF_TOTAL_PAGES);
  });

  it("Al-Kahf pages contain surah 18", () => {
    for (let p = KAHF_PAGE_START + 1; p <= KAHF_PAGE_END; p++) {
      const boundary = getPageBoundary(p);
      expect(boundary).toBeDefined();
      expect(boundary?.surah).toBe(18);
    }
  });
});

describe("getPageBoundary", () => {
  it("returns page 1 boundary", () => {
    const b = getPageBoundary(1);
    expect(b).toEqual({ page: 1, surah: 1, ayah: 1 });
  });

  it("returns page 604 boundary", () => {
    const b = getPageBoundary(604);
    expect(b).toBeDefined();
    expect(b?.page).toBe(604);
  });

  it("returns undefined for page 0", () => {
    expect(getPageBoundary(0)).toBeUndefined();
  });

  it("returns undefined for page 605", () => {
    expect(getPageBoundary(605)).toBeUndefined();
  });

  it("returns undefined for negative page", () => {
    expect(getPageBoundary(-1)).toBeUndefined();
  });
});

describe("getPageRange", () => {
  it("returns range for a single page (page 1)", () => {
    const range = getPageRange(1, 1);
    expect(range).toBeDefined();
    expect(range?.surahStart).toBe(1);
    expect(range?.ayahStart).toBe(1);
    expect(range?.surahEnd).toBe(1);
    expect(range?.ayahEnd).toBe(7);
    expect(range?.ayahCount).toBe(7);
  });

  it("returns range for multiple pages", () => {
    const range = getPageRange(1, 2);
    expect(range).toBeDefined();
    expect(range?.surahStart).toBe(1);
    expect(range?.ayahStart).toBe(1);
    expect(range?.surahEnd).toBe(2);
    // page 3 starts at 2:6, so page 2 ends at 2:5
    expect(range?.ayahEnd).toBe(5);
  });

  it("returns range for Al-Kahf pages (293-304)", () => {
    const range = getPageRange(KAHF_PAGE_START, KAHF_PAGE_END);
    expect(range).toBeDefined();
    // Page 293 starts at 17:105, page 305 starts at 19:1
    // so range ends at surah 18 ayah 110 (last ayah of Al-Kahf)
    expect(range?.surahEnd).toBe(18);
    expect(range?.ayahEnd).toBe(getSurah(18)?.ayahCount);
  });

  it("returns range for last page (604)", () => {
    const range = getPageRange(604, 604);
    expect(range).toBeDefined();
    expect(range?.surahEnd).toBe(114);
    expect(range?.ayahEnd).toBe(6);
  });

  it("calculates ayah count correctly across surahs", () => {
    // Pages 1-2: Al-Fatiha (7) + first 5 of Al-Baqara = 12
    const range = getPageRange(1, 2);
    expect(range).toBeDefined();
    expect(range?.ayahCount).toBe(12);
  });

  it("returns undefined for invalid start page", () => {
    expect(getPageRange(0, 5)).toBeUndefined();
  });

  it("returns undefined for invalid end page", () => {
    expect(getPageRange(1, 605)).toBeUndefined();
  });
});
