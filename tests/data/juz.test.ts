import { describe, expect, it } from "vitest";
import {
  getJuzEndPage,
  getJuzForPage,
  JUZ_START_PAGES,
} from "../../src/data/juz";
import { TOTAL_PAGES } from "../../src/data/pages";

describe("JUZ_START_PAGES", () => {
  it("has exactly 30 entries", () => {
    expect(JUZ_START_PAGES).toHaveLength(30);
  });

  it("starts at page 1", () => {
    expect(JUZ_START_PAGES[0]).toBe(1);
  });

  it("entries are in ascending order", () => {
    for (let i = 1; i < JUZ_START_PAGES.length; i++) {
      expect(JUZ_START_PAGES[i]).toBeGreaterThan(JUZ_START_PAGES[i - 1]);
    }
  });

  it("all entries are within valid page range", () => {
    for (const page of JUZ_START_PAGES) {
      expect(page).toBeGreaterThanOrEqual(1);
      expect(page).toBeLessThanOrEqual(TOTAL_PAGES);
    }
  });
});

describe("getJuzForPage", () => {
  it("page 1 is juz 1", () => {
    expect(getJuzForPage(1)).toBe(1);
  });

  it("page 21 is juz 1 (last page of juz 1)", () => {
    expect(getJuzForPage(21)).toBe(1);
  });

  it("page 22 is juz 2 (first page of juz 2)", () => {
    expect(getJuzForPage(22)).toBe(2);
  });

  it("page 582 is juz 30", () => {
    expect(getJuzForPage(582)).toBe(30);
  });

  it("page 604 is juz 30", () => {
    expect(getJuzForPage(604)).toBe(30);
  });
});

describe("getJuzEndPage", () => {
  it("juz 1 ends at page 21", () => {
    expect(getJuzEndPage(1)).toBe(21);
  });

  it("juz 2 ends at page 41", () => {
    expect(getJuzEndPage(2)).toBe(41);
  });

  it("juz 30 ends at page 604", () => {
    expect(getJuzEndPage(30)).toBe(604);
  });
});
