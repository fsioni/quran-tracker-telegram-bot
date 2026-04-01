-- Fix Al-Kahf first page: sessions starting at page 293 with type 'kahf'
-- incorrectly stored surah_start=17 (Al-Isra) instead of 18 (Al-Kahf).
-- Page 293 physically starts at 17:105, but for kahf sessions only 18:1+ matters.
-- Al-Isra has 111 ayahs, so 17:105-111 = 7 extra ayahs to subtract.
UPDATE sessions
SET surah_start = 18,
    ayah_start = 1,
    ayah_count = ayah_count - 7
WHERE type = 'kahf'
  AND page_start = 293
  AND surah_start = 17
  AND ayah_start = 105
  AND ayah_count >= 7;
