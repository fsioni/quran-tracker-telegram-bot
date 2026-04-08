# Milestone Proximity in Session Confirmation

**Issue:** #70
**Date:** 2026-04-07

## Context

After recording a session, the bot shows range, duration, and speed but gives no visibility on how close the user is to completing a surah, juz, or the full Quran. This feature adds a single "next milestone" line to normal session confirmations.

## Scope

- Show milestone for **normal** sessions only (not extra, not kahf)
- Display the **single closest milestone** using fixed priority: surah > juz > khatma

## Milestone Rules

| Milestone | Condition | Format |
|-----------|-----------|--------|
| Surah | `ayahEnd > surahAyahCount / 2` and `remaining > 0` | "X ayahs left to finish [surah name]" |
| Juz | `pageEnd` available and `juzEndPage - pageEnd <= 10` and `remaining > 0` | "Y pages left to finish Juz N" |
| Khatma | `pageEnd` available and `pageEnd >= 550` and `remaining > 0` | "Z pages left to complete the Quran" |

Priority is fixed: if surah qualifies, show surah regardless of juz/khatma. Juz and khatma require `pageEnd` (page-based sessions); for verse-only sessions (`/session`), only surah milestone is checked.

## New Files

### `src/data/juz.ts`

Constants and helpers for juz boundaries:

```typescript
// Starting page of each juz (Madina Mushaf)
export const JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export function getJuzForPage(page: number): number;
export function getJuzEndPage(juz: number): number;
```

### `src/services/milestone.ts`

Core milestone logic:

```typescript
export interface MilestoneInput {
  surahEnd: number;
  ayahEnd: number;
  pageEnd?: number | null;
}

export function getMilestoneText(input: MilestoneInput, t: Locale): string | null;
```

Returns the highest-priority qualifying milestone text, or `null`.

## Modified Files

### `src/locales/types.ts`

Add `milestone` key to `Locale` interface:

```typescript
milestone: {
  surahRemaining: (count: number, name: string) => string;
  juzRemaining: (count: number, juz: number) => string;
  khatmaRemaining: (count: number) => string;
};
```

### `src/locales/en.ts`

```typescript
milestone: {
  surahRemaining: (count, name) => `${count} ayahs left to finish ${name}`,
  juzRemaining: (count, juz) => `${count} pages left to finish Juz ${juz}`,
  khatmaRemaining: (count) => `${count} pages left to complete the Quran`,
},
```

### `src/locales/fr.ts`

```typescript
milestone: {
  surahRemaining: (count, name) => `${count} versets restants pour terminer ${name}`,
  juzRemaining: (count, juz) => `${count} pages restantes pour terminer le Juz ${juz}`,
  khatmaRemaining: (count) => `${count} pages restantes pour terminer le Coran`,
},
```

### `src/locales/ar.ts`

```typescript
milestone: {
  surahRemaining: (count, name) =>
    `${arPlural(count, { one: "آية واحدة", two: "آيتان", few: `${count} آيات`, many: `${count} آية`, other: `${count} آية` })} متبقية لإتمام ${name}`,
  juzRemaining: (count, juz) =>
    `${arPlural(count, { one: "صفحة واحدة", two: "صفحتان", few: `${count} صفحات`, many: `${count} صفحة`, other: `${count} صفحة` })} متبقية لإتمام الجزء ${juz}`,
  khatmaRemaining: (count) =>
    `${arPlural(count, { one: "صفحة واحدة", two: "صفحتان", few: `${count} صفحات`, many: `${count} صفحة`, other: `${count} صفحة` })} متبقية لختم القرآن`,
},
```

### `src/services/format.ts`

Export `getSurahName` (currently private) so `milestone.ts` can reuse it.

### `src/handlers/read.ts`

After `appendCompletedSurahs`, append milestone:

```typescript
const milestone = getMilestoneText({ surahEnd: rangeData.surahEnd, ayahEnd: rangeData.ayahEnd, pageEnd }, t);
if (milestone) parts.push(milestone);
```

### `src/handlers/session.ts`

After `appendCompletedSurahs`, append milestone (surah-only since no pageEnd):

```typescript
const milestone = getMilestoneText({ surahEnd, ayahEnd }, t);
if (milestone) msgParts.push(milestone);
```

### `src/handlers/timer.ts`

- **normal_page** in `dispatchPageResponse`: modify the `formatReply` callback to compute and append milestone
- **normal_verse** in `handleVerseResponse`: when `sessionType === "normal"`, compute and append milestone to the reply string

No changes for extra_page, extra_verse, or kahf paths.

## Testing

### Unit tests for `getMilestoneText` (`src/services/__tests__/milestone.test.ts`)

- Surah at halfway: ayah 144 of Al-Baqarah (286 ayahs) → shows milestone
- Surah before halfway: ayah 100 of Al-Baqarah → returns null
- Surah complete (ayahEnd === ayahCount): no milestone (remaining = 0)
- Juz within 10 pages: page 19 (juz 1 ends at 21) → shows milestone
- Juz beyond 10 pages: page 10 → returns null
- Khatma at page 555: shows milestone
- Khatma before page 550: returns null
- Priority: surah qualifies AND juz qualifies → surah wins
- No pageEnd: only surah milestone checked
- No milestone qualifies: returns null

### Snapshot tests for locale strings

- Verify milestone strings render correctly in en, fr, ar

### Existing tests

- Run `pnpm test` to verify no regressions

## Verification

1. `pnpm check` passes (lint + format)
2. `pnpm test` passes (all existing + new tests)
3. Manual verification scenarios:
   - `/read` ending at page 19 → "2 pages left to finish Juz 1"
   - `/session 2:270-280 5m` → "6 ayahs left to finish Al-Baqarah"
   - `/extra 300 5m` → no milestone line
