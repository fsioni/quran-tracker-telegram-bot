# Milestone Proximity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After every normal session confirmation, show the closest upcoming milestone (surah completion, juz completion, or khatma completion).

**Architecture:** New `src/data/juz.ts` for juz boundary data, new `src/services/milestone.ts` for milestone logic, locale additions for 3 languages, integration in 4 handler call sites.

**Tech Stack:** TypeScript, Vitest (TDD with snapshots), grammY

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/data/juz.ts` | Create | Juz start pages, `getJuzForPage()`, `getJuzEndPage()` |
| `src/services/milestone.ts` | Create | `getMilestoneText()` — core milestone logic |
| `src/locales/types.ts` | Modify | Add `milestone` key to `Locale` interface |
| `src/locales/en.ts` | Modify | English milestone strings |
| `src/locales/fr.ts` | Modify | French milestone strings |
| `src/locales/ar.ts` | Modify | Arabic milestone strings (with `arPlural`) |
| `src/services/format.ts` | Modify | Export `getSurahName` (currently private) |
| `src/handlers/read.ts` | Modify | Append milestone after `appendCompletedSurahs` |
| `src/handlers/session.ts` | Modify | Append milestone after `appendCompletedSurahs` |
| `src/handlers/timer.ts` | Modify | Append milestone in `dispatchPageResponse` (normal_page) and `handleVerseResponse` (normal_verse) |
| `tests/data/juz.test.ts` | Create | Unit tests for juz helpers |
| `tests/milestone.test.ts` | Create | Unit tests for `getMilestoneText` |
| `tests/locales.test.ts` | Modify | Add milestone locale completeness checks |

---

### Task 1: Juz boundary data module

**Files:**
- Create: `src/data/juz.ts`
- Create: `tests/data/juz.test.ts`

- [ ] **Step 1: Write failing tests for juz helpers**

Create `tests/data/juz.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  JUZ_START_PAGES,
  getJuzForPage,
  getJuzEndPage,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/data/juz.test.ts`
Expected: FAIL — module `../../src/data/juz` not found

- [ ] **Step 3: Implement juz module**

Create `src/data/juz.ts`:

```typescript
import { TOTAL_PAGES } from "./pages";

/** Starting page of each juz (1-30) in the Madina Mushaf */
export const JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

/** Returns which juz (1-30) a given page belongs to */
export function getJuzForPage(page: number): number {
  for (let i = JUZ_START_PAGES.length - 1; i >= 0; i--) {
    if (page >= JUZ_START_PAGES[i]) return i + 1;
  }
  return 1;
}

/** Returns the last page of the given juz */
export function getJuzEndPage(juz: number): number {
  if (juz >= 30) return TOTAL_PAGES;
  return JUZ_START_PAGES[juz] - 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/data/juz.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/juz.ts tests/data/juz.test.ts
git commit -m "Add juz boundary data and helpers (#70)"
```

---

### Task 2: Locale keys for milestone strings

**Files:**
- Modify: `src/locales/types.ts` (add after `validation` block, before `welcomeHeader`, around line 395)
- Modify: `src/locales/en.ts` (add before `nativeName`, around line 392)
- Modify: `src/locales/fr.ts` (add before `nativeName`, around line 395)
- Modify: `src/locales/ar.ts` (add before `nativeName`, around line 389)
- Modify: `tests/locales.test.ts` (add milestone template checks)

- [ ] **Step 1: Add milestone type to Locale interface**

In `src/locales/types.ts`, add after the closing `};` of `validation` (line 394) and before `welcomeHeader` (line 397):

```typescript
  // Milestone proximity
  milestone: {
    surahRemaining: (count: number, name: string) => string;
    juzRemaining: (count: number, juz: number) => string;
    khatmaRemaining: (count: number) => string;
  };
```

- [ ] **Step 2: Run type check to confirm locales fail**

Run: `pnpm exec tsc --noEmit`
Expected: Type errors in en.ts, fr.ts, ar.ts — missing `milestone` property

- [ ] **Step 3: Add English milestone strings**

In `src/locales/en.ts`, add before `nativeName: "English"` (line 392):

```typescript
  milestone: {
    surahRemaining: (count, name) =>
      `${count} ${count === 1 ? "ayah" : "ayahs"} left to finish ${name}`,
    juzRemaining: (count, juz) =>
      `${count} ${count === 1 ? "page" : "pages"} left to finish Juz ${juz}`,
    khatmaRemaining: (count) =>
      `${count} ${count === 1 ? "page" : "pages"} left to complete the Quran`,
  },
```

- [ ] **Step 4: Add French milestone strings**

In `src/locales/fr.ts`, add before `nativeName: "Français"` (line 395):

```typescript
  milestone: {
    surahRemaining: (count, name) =>
      `${count} ${count <= 1 ? "verset restant" : "versets restants"} pour terminer ${name}`,
    juzRemaining: (count, juz) =>
      `${count} ${count <= 1 ? "page restante" : "pages restantes"} pour terminer le Juz ${juz}`,
    khatmaRemaining: (count) =>
      `${count} ${count <= 1 ? "page restante" : "pages restantes"} pour terminer le Coran`,
  },
```

- [ ] **Step 5: Add Arabic milestone strings**

In `src/locales/ar.ts`, add before `nativeName: "العربية"` (line 389). Uses `arPlural` (already imported at top of file):

```typescript
  milestone: {
    surahRemaining: (count, name) =>
      `${arPlural(count, {
        one: "آية واحدة متبقية",
        two: "آيتان متبقيتان",
        few: `${count} آيات متبقية`,
        many: `${count} آية متبقية`,
        other: `${count} آية متبقية`,
      })} لإتمام ${name}`,
    juzRemaining: (count, juz) =>
      `${arPlural(count, {
        one: "صفحة واحدة متبقية",
        two: "صفحتان متبقيتان",
        few: `${count} صفحات متبقية`,
        many: `${count} صفحة متبقية`,
        other: `${count} صفحة متبقية`,
      })} لإتمام الجزء ${juz}`,
    khatmaRemaining: (count) =>
      `${arPlural(count, {
        one: "صفحة واحدة متبقية",
        two: "صفحتان متبقيتان",
        few: `${count} صفحات متبقية`,
        many: `${count} صفحة متبقية`,
        other: `${count} صفحة متبقية`,
      })} لختم القرآن`,
  },
```

- [ ] **Step 6: Add milestone checks to locale tests**

In `tests/locales.test.ts`, inside the `"%s: all template functions return non-empty strings"` test (around line 151, before the closing `});`), add:

```typescript
    // Milestone templates
    expect(t.milestone.surahRemaining(5, "Al-Baqara")).toBeTruthy();
    expect(t.milestone.juzRemaining(3, 2)).toBeTruthy();
    expect(t.milestone.khatmaRemaining(10)).toBeTruthy();
```

- [ ] **Step 7: Run all tests**

Run: `pnpm test`
Expected: ALL PASS (existing locale exhaustiveness tests will automatically validate the new keys since they walk all keys dynamically)

- [ ] **Step 8: Update snapshots if needed**

Run: `pnpm test -- -u`
Expected: Snapshots updated (if any snapshot tests are affected)

- [ ] **Step 9: Commit**

```bash
git add src/locales/types.ts src/locales/en.ts src/locales/fr.ts src/locales/ar.ts tests/locales.test.ts
git commit -m "Add milestone locale keys for en, fr, ar (#70)"
```

---

### Task 3: Export getSurahName from format.ts

**Files:**
- Modify: `src/services/format.ts` (line 10)

- [ ] **Step 1: Export the function**

In `src/services/format.ts`, change line 10 from:

```typescript
function getSurahName(surahNum: number, t: Locale): string {
```

to:

```typescript
export function getSurahName(surahNum: number, t: Locale): string {
```

- [ ] **Step 2: Verify no regressions**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/services/format.ts
git commit -m "Export getSurahName from format.ts (#70)"
```

---

### Task 4: Milestone logic module

**Files:**
- Create: `src/services/milestone.ts`
- Create: `tests/milestone.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/milestone.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { en } from "../src/locales/en";
import { fr } from "../src/locales/fr";
import { ar } from "../src/locales/ar";
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
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 270 },
        en
      );
      expect(result).toBe("16 ayahs left to finish Al-Baqara");
    });

    it("returns null when before halfway", () => {
      // Al-Baqara: ayah 100 is before halfway (143)
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 100 },
        en
      );
      expect(result).toBeNull();
    });

    it("returns null when exactly at halfway", () => {
      // Al-Baqara: 286/2 = 143, ayah 143 is NOT past halfway
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 143 },
        en
      );
      expect(result).toBeNull();
    });

    it("shows surah milestone at halfway + 1", () => {
      // Al-Baqara: ayah 144 is past halfway (143)
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 144 },
        en
      );
      expect(result).toBe("142 ayahs left to finish Al-Baqara");
    });

    it("returns null when surah is complete (remaining = 0)", () => {
      // Al-Baqara: ayah 286 = last ayah
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 286 },
        en
      );
      expect(result).toBeNull();
    });

    it("uses singular 'ayah' for count 1", () => {
      // Al-Fatiha has 7 ayahs; ayah 6 → 1 remaining, past halfway (3.5)
      const result = getMilestoneText(
        { surahEnd: 1, ayahEnd: 6 },
        en
      );
      expect(result).toBe("1 ayah left to finish Al-Fatiha");
    });

    it("uses Arabic surah name when locale is ar", () => {
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 270 },
        ar
      );
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
      // Juz 1 ends at page 21; page 5 → 16 pages remaining
      const result = getMilestoneText(
        { surahEnd: 1, ayahEnd: 5, pageEnd: 5 },
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
      const result = getMilestoneText(
        { surahEnd: 2, ayahEnd: 100 },
        en
      );
      expect(result).toBeNull();
    });
  });

  describe("khatma milestone", () => {
    it("shows khatma milestone when past page 550", () => {
      // Page 598 → 6 pages remaining
      const result = getMilestoneText(
        { surahEnd: 110, ayahEnd: 1, pageEnd: 598 },
        en
      );
      expect(result).toBe("6 pages left to complete the Quran");
    });

    it("returns null when before page 550", () => {
      const result = getMilestoneText(
        { surahEnd: 100, ayahEnd: 5, pageEnd: 500 },
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
      // Page 555, surah not at halfway, juz 27 ends at 541 (not within 10)
      // Actually juz 28 starts at 542, so page 555 is in juz 28 (ends at 561). 561-555=6 → juz qualifies!
      // Let me use page 560: juz 29 starts at 562, so page 560 is in juz 28 (ends at 561). 561-560=1 → juz qualifies.
      // Need a case where juz does NOT qualify but khatma does.
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
    it.each(locales)(
      "%s: all milestone strings are non-empty",
      (_, t) => {
        const surah = getMilestoneText(
          { surahEnd: 2, ayahEnd: 270 },
          t
        );
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
      }
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/milestone.test.ts`
Expected: FAIL — module `../src/services/milestone` not found

- [ ] **Step 3: Implement milestone module**

Create `src/services/milestone.ts`:

```typescript
import { getJuzEndPage, getJuzForPage } from "../data/juz";
import { TOTAL_PAGES } from "../data/pages";
import { getSurah } from "../data/surahs";
import type { Locale } from "../locales/types";
import { getSurahName } from "./format";

export interface MilestoneInput {
  surahEnd: number;
  ayahEnd: number;
  pageEnd?: number | null;
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
      return t.milestone.surahRemaining(remaining, getSurahName(input.surahEnd, t));
    }
  }

  if (input.pageEnd == null) return null;

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/milestone.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/milestone.ts tests/milestone.test.ts
git commit -m "Add milestone proximity logic (#70)"
```

---

### Task 5: Integrate milestone in read handler

**Files:**
- Modify: `src/handlers/read.ts`

- [ ] **Step 1: Add milestone to read handler**

In `src/handlers/read.ts`, add the import at the top (after existing imports):

```typescript
import { getMilestoneText } from "../services/milestone";
```

Then, after the `appendCompletedSurahs(...)` call (line 106) and before `await ctx.reply(parts.join("\n"))` (line 108), add:

```typescript
  const milestone = getMilestoneText(
    { surahEnd: rangeData.surahEnd, ayahEnd: rangeData.ayahEnd, pageEnd },
    t
  );
  if (milestone) parts.push(milestone);
```

- [ ] **Step 2: Run tests**

Run: `pnpm test tests/handlers/read.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/handlers/read.ts
git commit -m "Show milestone proximity in /read confirmation (#70)"
```

---

### Task 6: Integrate milestone in session handler

**Files:**
- Modify: `src/handlers/session.ts`

- [ ] **Step 1: Add milestone to session handler**

In `src/handlers/session.ts`, add the import:

```typescript
import { getMilestoneText } from "../services/milestone";
```

After the `appendCompletedSurahs(...)` call (line 81) and before `await ctx.reply(msgParts.join("\n"))` (line 83), add:

```typescript
  const milestone = getMilestoneText({ surahEnd, ayahEnd }, t);
  if (milestone) msgParts.push(milestone);
```

Note: `/session` is verse-based (no `pageEnd`), so only surah milestones will be checked.

- [ ] **Step 2: Run tests**

Run: `pnpm test tests/handlers/session.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/handlers/session.ts
git commit -m "Show milestone proximity in /session confirmation (#70)"
```

---

### Task 7: Integrate milestone in timer handler

**Files:**
- Modify: `src/handlers/timer.ts`

- [ ] **Step 1: Add import**

In `src/handlers/timer.ts`, add:

```typescript
import { getMilestoneText } from "../services/milestone";
```

- [ ] **Step 2: Modify normal_page callback in dispatchPageResponse**

In `src/handlers/timer.ts`, find the `normal_page` case in `dispatchPageResponse` (around line 647). Change the callback from:

```typescript
        (_r, ps, pe, dur) =>
          formatReadConfirmation(
            {
              pageStart: ps,
              pageEnd: pe,
              durationSeconds: dur,
              totalPagesRead: pe,
              totalPages: TOTAL_PAGES,
            },
            t
          )
```

to:

```typescript
        (session, ps, pe, dur) => {
          const confirmation = formatReadConfirmation(
            {
              pageStart: ps,
              pageEnd: pe,
              durationSeconds: dur,
              totalPagesRead: pe,
              totalPages: TOTAL_PAGES,
            },
            t
          );
          const milestone = getMilestoneText(
            { surahEnd: session.surahEnd, ayahEnd: session.ayahEnd, pageEnd: pe },
            t
          );
          return milestone ? `${confirmation}\n${milestone}` : confirmation;
        }
```

- [ ] **Step 3: Modify handleVerseResponse for normal sessions**

In `src/handlers/timer.ts`, find `handleVerseResponse` (around line 517-522). Change from:

```typescript
  await Promise.all([
    clearTimerState(ctx.db),
    ctx.reply(
      formatSessionConfirmation({ ...result.value, type: sessionType }, t)
    ),
  ]);
```

to:

```typescript
  let reply = formatSessionConfirmation(
    { ...result.value, type: sessionType },
    t
  );
  if (sessionType === "normal") {
    const milestone = getMilestoneText(
      { surahEnd, ayahEnd },
      t
    );
    if (milestone) reply += `\n${milestone}`;
  }
  await Promise.all([clearTimerState(ctx.db), ctx.reply(reply)]);
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/handlers/timer.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/timer.ts
git commit -m "Show milestone proximity in /stop confirmation (#70)"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Run lint and format**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 3: Update snapshots if needed**

If any snapshot tests fail due to the new milestone line appearing in formatted output:

Run: `pnpm test -- -u`
Expected: Snapshots updated, all tests pass

- [ ] **Step 4: Final commit if snapshots were updated**

```bash
git add -A
git commit -m "Update snapshots for milestone proximity (#70)"
```
