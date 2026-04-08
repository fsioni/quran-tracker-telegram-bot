import { describe, expect, it } from "vitest";
import { ar } from "../src/locales/ar";
import { en } from "../src/locales/en";
import { fr } from "../src/locales/fr";
import type { Locale } from "../src/locales/types";
import { getMilestoneText } from "../src/services/milestone";

const locales: [string, Locale][] = [
  ["en", en],
  ["fr", fr],
  ["ar", ar],
];

describe("getMilestoneText", () => {
  describe("surah milestone", () => {
    it("shows surah milestone when past halfway", () => {
      // Al-Baqara has 286 ayahs; ayah 270 is past halfway (143)
      const result = getMilestoneText({ surahEnd: 2, ayahEnd: 270 }, en);
      expect(result).toBe("16 ayahs left to finish Al-Baqara");
    });

    it("returns null when before halfway", () => {
      // Al-Baqara: ayah 100 is before halfway (143)
      const result = getMilestoneText({ surahEnd: 2, ayahEnd: 100 }, en);
      expect(result).toBeNull();
    });

    it("returns null when exactly at halfway", () => {
      // Al-Baqara: 286/2 = 143, ayah 143 is NOT past halfway
      const result = getMilestoneText({ surahEnd: 2, ayahEnd: 143 }, en);
      expect(result).toBeNull();
    });

    it("shows surah milestone at halfway + 1", () => {
      // Al-Baqara: ayah 144 is past halfway (143)
      const result = getMilestoneText({ surahEnd: 2, ayahEnd: 144 }, en);
      expect(result).toBe("142 ayahs left to finish Al-Baqara");
    });

    it("returns null when surah is complete (remaining = 0)", () => {
      // Al-Baqara: ayah 286 = last ayah
      const result = getMilestoneText({ surahEnd: 2, ayahEnd: 286 }, en);
      expect(result).toBeNull();
    });

    it("uses singular 'ayah' for count 1", () => {
      // Al-Fatiha has 7 ayahs; ayah 6 → 1 remaining, past halfway (3.5)
      const result = getMilestoneText({ surahEnd: 1, ayahEnd: 6 }, en);
      expect(result).toBe("1 ayah left to finish Al-Fatiha");
    });

    it("uses Arabic surah name when locale is ar", () => {
      const result = getMilestoneText({ surahEnd: 2, ayahEnd: 270 }, ar);
      expect(result).toContain("البقرة");
    });
  });

  describe("juz milestone", () => {
    it("shows juz milestone when within 10 pages of end", () => {
      // Juz 1 ends at page 21; page 19 → 2 pages remaining
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 100, pageEnd: 19 },
        en
      );
      expect(result).toBe("2 pages left to finish Juz 1");
    });

    it("returns null when more than 10 pages from juz end", () => {
      // Juz 1 ends at page 21; page 5 → 16 pages remaining; surah not past halfway
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 50, pageEnd: 5 },
        en
      );
      expect(result).toBeNull();
    });

    it("shows juz milestone at exactly 10 pages remaining", () => {
      // Juz 1 ends at page 21; page 11 → 10 pages remaining
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 100, pageEnd: 11 },
        en
      );
      expect(result).toBe("10 pages left to finish Juz 1");
    });

    it("returns null at exactly juz boundary (remaining = 0)", () => {
      // Page 21 is last page of juz 1 → 0 remaining
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 100, pageEnd: 21 },
        en
      );
      expect(result).toBeNull();
    });

    it("does not show juz when pageEnd is null", () => {
      // No pageEnd → only surah milestone checked; ayah 100 is before halfway of Al-Baqara
      const result = getMilestoneText({ surahEnd: 2, ayahEnd: 100 }, en);
      expect(result).toBeNull();
    });
  });

  describe("khatma milestone", () => {
    it("shows khatma milestone when past page 550", () => {
      // Page 562 = start of juz 29 (ends 581), juzRemaining=19 > 10 → juz doesn't qualify
      // Khatma: 604-562=42, 562 >= 550 → qualifies
      // Surah 78 (An-Naba, 40 ayahs), ayah 1 → not past halfway
      const result = getMilestoneText(
        { surahEnd: 78, ayahEnd: 1, pageEnd: 562 },
        en
      );
      expect(result).toBe("42 pages left to complete the Quran");
    });

    it("returns null when before page 550", () => {
      // Page 10, juz 1 (ends 21), juzRemaining=11 > 10 → juz doesn't qualify
      // 10 < 550 → khatma doesn't qualify; surah not past halfway
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 50, pageEnd: 10 },
        en
      );
      expect(result).toBeNull();
    });

    it("shows khatma at exactly page 550", () => {
      const result = getMilestoneText(
        { surahEnd: 100, ayahEnd: 5, pageEnd: 550 },
        en
      );
      expect(result).toBe("54 pages left to complete the Quran");
    });

    it("returns null at page 604 (remaining = 0)", () => {
      const result = getMilestoneText(
        { surahEnd: 114, ayahEnd: 6, pageEnd: 604 },
        en
      );
      expect(result).toBeNull();
    });
  });

  describe("priority", () => {
    it("surah wins over juz when both qualify", () => {
      // Al-Baqara (286 ayahs), ayah 270 → surah qualifies (16 remaining)
      // Page 19 → juz 1 also qualifies (2 pages remaining)
      // Surah should win
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 270, pageEnd: 19 },
        en
      );
      expect(result).toBe("16 ayahs left to finish Al-Baqara");
    });

    it("juz wins over khatma when both qualify (surah does not)", () => {
      // Juz 30 starts at page 582, ends at 604
      // Page 598 → juz qualifies (6 pages), khatma qualifies (6 pages)
      // Use a surah that does NOT qualify: An-Nas (114) has 6 ayahs; ayah 1 = before halfway
      const result = getMilestoneText(
        { surahEnd: 114, ayahEnd: 1, pageEnd: 598 },
        en
      );
      expect(result).toBe("6 pages left to finish Juz 30");
    });

    it("khatma shown when only it qualifies", () => {
      // Page 582 is start of juz 30 (ends at 604). 604-582=22 → juz does NOT qualify (>10).
      // Khatma: 604-582=22 and 582 >= 550 → qualifies.
      // Surah at page 582: surah 78 (An-Naba) has 40 ayahs. ayah 1 = not past halfway.
      const result = getMilestoneText(
        { surahEnd: 78, ayahEnd: 1, pageEnd: 582 },
        en
      );
      expect(result).toBe("22 pages left to complete the Quran");
    });
  });

  describe("localization", () => {
    it.each(locales)("%s: all milestone strings are non-empty", (_, t) => {
      const surah = getMilestoneText({ surahEnd: 2, ayahEnd: 270 }, t);
      expect(surah).toBeTruthy();

      const juz = getMilestoneText(
        { surahEnd: 2, ayahEnd: 100, pageEnd: 19 },
        t
      );
      expect(juz).toBeTruthy();

      const khatma = getMilestoneText(
        { surahEnd: 78, ayahEnd: 1, pageEnd: 582 },
        t
      );
      expect(khatma).toBeTruthy();
    });
  });
});
