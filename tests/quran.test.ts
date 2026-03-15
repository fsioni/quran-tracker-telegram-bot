import {
  validateSurah,
  validateAyah,
  validateRange,
  calculateAyahCount,
  getCompletedSurahs,
} from "../src/services/quran";

describe("validateSurah", () => {
  it("accepts surah 1 (Al-Fatiha)", () => {
    const result = validateSurah(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.number).toBe(1);
      expect(result.value.ayahCount).toBe(7);
    }
  });

  it("accepts surah 2 (Al-Baqara)", () => {
    const result = validateSurah(2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.number).toBe(2);
      expect(result.value.ayahCount).toBe(286);
    }
  });

  it("accepts surah 114 (An-Nas)", () => {
    const result = validateSurah(114);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.number).toBe(114);
    }
  });

  it("rejects surah 0", () => {
    const result = validateSurah(0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("la sourate 0 n'existe pas (1-114)");
    }
  });

  it("rejects surah 115", () => {
    const result = validateSurah(115);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("la sourate 115 n'existe pas (1-114)");
    }
  });

  it("rejects surah -1", () => {
    const result = validateSurah(-1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("la sourate -1 n'existe pas (1-114)");
    }
  });

  it("rejects non-integer 1.5", () => {
    const result = validateSurah(1.5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("la sourate 1.5 n'existe pas (1-114)");
    }
  });
});

describe("validateAyah", () => {
  it("accepts ayah 1 of surah 1", () => {
    const result = validateAyah(1, 1);
    expect(result.ok).toBe(true);
  });

  it("accepts max ayah of surah 1 (7)", () => {
    const result = validateAyah(1, 7);
    expect(result.ok).toBe(true);
  });

  it("accepts max ayah of surah 2 (286)", () => {
    const result = validateAyah(2, 286);
    expect(result.ok).toBe(true);
  });

  it("rejects ayah 0", () => {
    const result = validateAyah(1, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "la sourate 1 n'a que 7 versets (verset 0 demande)",
      );
    }
  });

  it("rejects ayah beyond max (surah 1 has 7 ayahs)", () => {
    const result = validateAyah(1, 8);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "la sourate 1 n'a que 7 versets (verset 8 demande)",
      );
    }
  });

  it("propagates invalid surah error", () => {
    const result = validateAyah(0, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("la sourate 0 n'existe pas (1-114)");
    }
  });
});

describe("validateRange", () => {
  it("accepts same surah range (1:1 to 1:7)", () => {
    const result = validateRange(1, 1, 1, 7);
    expect(result.ok).toBe(true);
  });

  it("accepts single ayah range (2:100 to 2:100)", () => {
    const result = validateRange(2, 100, 2, 100);
    expect(result.ok).toBe(true);
  });

  it("accepts cross-surah range (2:280 to 3:10)", () => {
    const result = validateRange(2, 280, 3, 10);
    expect(result.ok).toBe(true);
  });

  it("rejects reverse order in same surah (1:5 to 1:3)", () => {
    const result = validateRange(1, 5, 1, 3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("la fin (1:3) precede le debut (1:5)");
    }
  });

  it("rejects reverse surah order (3:1 to 2:1)", () => {
    const result = validateRange(3, 1, 2, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("la fin (2:1) precede le debut (3:1)");
    }
  });

  it("propagates invalid start surah error", () => {
    const result = validateRange(0, 1, 1, 1);
    expect(result.ok).toBe(false);
  });

  it("propagates invalid end ayah error", () => {
    const result = validateRange(1, 1, 1, 999);
    expect(result.ok).toBe(false);
  });
});

describe("calculateAyahCount", () => {
  it("returns 7 for 2:77-2:83", () => {
    expect(calculateAyahCount(2, 77, 2, 83)).toBe(7);
  });

  it("returns 17 for 2:280-3:10", () => {
    // 7 remaining in surah 2 (280-286) + 10 in surah 3
    expect(calculateAyahCount(2, 280, 3, 10)).toBe(17);
  });

  it("returns 212 for 2:280-4:5", () => {
    // 7 remaining in surah 2 + 200 complete surah 3 + 5
    expect(calculateAyahCount(2, 280, 4, 5)).toBe(212);
  });

  it("returns 7 for 1:1-1:7", () => {
    expect(calculateAyahCount(1, 1, 1, 7)).toBe(7);
  });

  it("returns 1 for single ayah (1:1-1:1)", () => {
    expect(calculateAyahCount(1, 1, 1, 1)).toBe(1);
  });

  it("returns full surah count for complete surah 2 (2:1-2:286)", () => {
    expect(calculateAyahCount(2, 1, 2, 286)).toBe(286);
  });
});

// --- getCompletedSurahs ---

describe("getCompletedSurahs", () => {
  it("returns [Al-Fatiha] for 1:1-1:7", () => {
    const result = getCompletedSurahs(1, 1, 1, 7);
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
  });

  it("returns [] for 2:100-2:150 (incomplete surah)", () => {
    const result = getCompletedSurahs(2, 100, 2, 150);
    expect(result).toHaveLength(0);
  });

  it("returns [Al-Ikhlas, Al-Falaq, An-Nas] for 112:1-114:6", () => {
    const result = getCompletedSurahs(112, 1, 114, 6);
    expect(result).toHaveLength(3);
    expect(result[0].number).toBe(112);
    expect(result[1].number).toBe(113);
    expect(result[2].number).toBe(114);
  });

  it("returns [] for 2:280-3:10 (neither surah complete)", () => {
    const result = getCompletedSurahs(2, 280, 3, 10);
    expect(result).toHaveLength(0);
  });

  it("returns [Al-Fatiha, Al-Baqara] for 1:1-2:286", () => {
    const result = getCompletedSurahs(1, 1, 2, 286);
    expect(result).toHaveLength(2);
    expect(result[0].number).toBe(1);
    expect(result[1].number).toBe(2);
  });
});
