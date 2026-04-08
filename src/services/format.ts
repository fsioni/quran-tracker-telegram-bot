import { effectivePageCount, TOTAL_PAGES } from "../data/pages";
import { getSurah } from "../data/surahs";
import type { Locale } from "../locales/types";
import { err, ok, type Result } from "../types";
import type { Session, SpeedAverages, TypeSpeed } from "./db/types";
import { getCompletedSurahs } from "./quran";
import type { WeeklyRecapData } from "./weekly-recap";

function getSurahName(surahNum: number, t: Locale): string {
  const surah = getSurah(surahNum);
  if (!surah) {
    return t.session.surahFallback(surahNum);
  }
  return t.lang === "ar" ? surah.nameAr : surah.name;
}

export interface SpeedReportData {
  averages: SpeedAverages;
  bestSession: Session | null;
  byType: TypeSpeed[];
  longestSession: Session | null;
}

function formatSpeedOneDecimal(speed: number): string {
  return speed.toFixed(1);
}

function formatOneDecimalTrimmed(n: number): string {
  return String(Number.parseFloat(n.toFixed(1)));
}

export interface ParsedRange {
  ayahEnd: number;
  ayahStart: number;
  surahEnd: number;
  surahStart: number;
}

export interface ParsedImportLine {
  date: string;
  duration: number;
  range: ParsedRange;
  time: string;
}

// --- Regex constants ---

const VERSE_START_RE = /^(\d+):(\d+)$/;
const DURATION_RE = /^(?:(\d+)h)?(\d+)m(\d+)?$/;
const SAME_SURAH_RE = /^(\d+):(\d+)-(\d+)$/;
const CROSS_SURAH_RE = /^(\d+):(\d+)-(\d+):(\d+)$/;
const IMPORT_LINE_RE =
  /^(\d{2})\/(\d{2}),\s*(\d{1,2})[h:](\d{2})\s*-\s*(.+?)\s*-\s*(.+)$/;
const PAGE_RANGE_RE = /^(\d+)-(\d+)$/;
const SINGLE_PAGE_RE = /^(\d+)$/;
const WHITESPACE_RE = /\s+/;

// --- Parsing functions ---

/** Parses "2:77" format only. Callers must validate surah/ayah via validateAyah or validateRange. */
export function parseVerseStart(
  input: string,
  t: Locale
): Result<{ surah: number; ayah: number }> {
  const match = input.match(VERSE_START_RE);
  if (!match) {
    return err(t.parse.invalidVerseFormat(input));
  }
  return ok({
    surah: Number.parseInt(match[1], 10),
    ayah: Number.parseInt(match[2], 10),
  });
}

export function parseDuration(input: string, t: Locale): Result<number> {
  const match = input.match(DURATION_RE);
  if (!match) {
    return err(t.parse.invalidDurationFormat(input));
  }
  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutes = Number.parseInt(match[2], 10);
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;
  return ok(hours * 3600 + minutes * 60 + seconds);
}

export function parseRange(input: string, t: Locale): Result<ParsedRange> {
  // Same surah: 2:77-83
  const sameSurah = input.match(SAME_SURAH_RE);
  if (sameSurah) {
    const surah = Number.parseInt(sameSurah[1], 10);
    return ok({
      surahStart: surah,
      ayahStart: Number.parseInt(sameSurah[2], 10),
      surahEnd: surah,
      ayahEnd: Number.parseInt(sameSurah[3], 10),
    });
  }

  // Cross-surah: 2:280-3:10
  const crossSurah = input.match(CROSS_SURAH_RE);
  if (crossSurah) {
    return ok({
      surahStart: Number.parseInt(crossSurah[1], 10),
      ayahStart: Number.parseInt(crossSurah[2], 10),
      surahEnd: Number.parseInt(crossSurah[3], 10),
      ayahEnd: Number.parseInt(crossSurah[4], 10),
    });
  }

  return err(t.parse.invalidRangeFormat(input));
}

export function parseImportLine(
  line: string,
  t: Locale,
  referenceYear?: number,
  referenceDate?: Date
): Result<ParsedImportLine> {
  // Format: JJ/MM, HHhMM - DUREE - RANGE
  const match = line.match(IMPORT_LINE_RE);
  if (!match) {
    return err(t.parse.invalidImportLineFormat(line));
  }

  const day = match[1];
  const month = match[2];
  const hour = match[3].padStart(2, "0");
  const minute = match[4];
  const durationStr = match[5].trim();
  const rangeStr = match[6].trim();

  const parsedMonth = Number.parseInt(month, 10);
  const parsedDay = Number.parseInt(day, 10);

  // Validate month/day ranges
  if (parsedMonth < 1 || parsedMonth > 12) {
    return err(t.parse.invalidMonth(month));
  }

  const now = referenceDate ?? new Date();
  const year = referenceYear ?? now.getFullYear();

  // Validate day against days in month
  const daysInMonth = new Date(year, parsedMonth, 0).getDate();
  if (parsedDay < 1 || parsedDay > daysInMonth) {
    return err(t.parse.invalidDay(day, month, daysInMonth));
  }

  // Determine year: if date is in the future relative to referenceDate, use previous year
  const candidateDate = new Date(year, parsedMonth - 1, parsedDay);
  const refDate = new Date(year, now.getMonth(), now.getDate());
  const finalYear = candidateDate > refDate ? year - 1 : year;

  const durationResult = parseDuration(durationStr, t);
  if (!durationResult.ok) {
    return err(durationResult.error);
  }

  const rangeResult = parseRange(rangeStr, t);
  if (!rangeResult.ok) {
    return err(rangeResult.error);
  }

  return ok({
    date: `${finalYear}-${month}-${day}`,
    time: `${hour}:${minute}`,
    duration: durationResult.value,
    range: rangeResult.value,
  });
}

export function parsePage(
  input: string,
  t: Locale
): Result<{ pageStart: number; pageEnd: number }> {
  const rangeMatch = input.match(PAGE_RANGE_RE);
  if (rangeMatch) {
    const pageStart = Number.parseInt(rangeMatch[1], 10);
    const pageEnd = Number.parseInt(rangeMatch[2], 10);
    if (pageStart < 1 || pageStart > TOTAL_PAGES) {
      return err(t.parse.invalidPage(pageStart, TOTAL_PAGES));
    }
    if (pageEnd < 1 || pageEnd > TOTAL_PAGES) {
      return err(t.parse.invalidPage(pageEnd, TOTAL_PAGES));
    }
    if (pageStart > pageEnd) {
      return err(t.parse.pageStartAfterEnd(pageStart, pageEnd));
    }
    return ok({ pageStart, pageEnd });
  }

  const singleMatch = input.match(SINGLE_PAGE_RE);
  if (singleMatch) {
    const page = Number.parseInt(singleMatch[1], 10);
    if (page < 1 || page > TOTAL_PAGES) {
      return err(t.parse.invalidPage(page, TOTAL_PAGES));
    }
    return ok({ pageStart: page, pageEnd: page });
  }

  return err(t.parse.invalidPageFormat(input));
}

export function parsePageCountAndDuration(
  input: string,
  cmdExample: string,
  t: Locale
): Result<{ count: number; durationSeconds: number | null }> {
  if (!input) {
    return ok({ count: 1, durationSeconds: null });
  }
  const parts = input.split(WHITESPACE_RE);

  if (parts.length === 1) {
    // Single part: try as duration first, then as page count (no duration)
    const durationResult = parseDuration(parts[0], t);
    if (durationResult.ok) {
      return ok({ count: 1, durationSeconds: durationResult.value });
    }
    const parsed = Number.parseInt(parts[0], 10);
    if (!Number.isNaN(parsed) && parsed >= 1) {
      return ok({ count: parsed, durationSeconds: null });
    }
    return err(t.parse.invalidFormat(cmdExample));
  }

  // Two parts: count + duration
  const parsed = Number.parseInt(parts[0], 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return err(t.parse.invalidPageCount(cmdExample));
  }

  const durationResult = parseDuration(parts[1], t);
  if (!durationResult.ok) {
    return durationResult as Result<{
      count: number;
      durationSeconds: number | null;
    }>;
  }

  return ok({ count: parsed, durationSeconds: durationResult.value });
}

// --- Formatting functions ---

export function formatRange(
  surahStart: number,
  ayahStart: number,
  surahEnd: number,
  ayahEnd: number,
  t: Locale
): string {
  const startName = getSurahName(surahStart, t);
  if (surahStart === surahEnd) {
    return `${startName} ${surahStart}:${ayahStart}-${ayahEnd}`;
  }
  const endName = getSurahName(surahEnd, t);
  return `${startName} ${surahStart}:${ayahStart} - ${endName} ${surahEnd}:${ayahEnd}`;
}

export function formatDuration(seconds: number | null, t?: Locale): string {
  if (seconds == null) {
    return "--";
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const hSuf = t?.fmt.hours ?? "h";
  const mSuf = t?.fmt.minutes ?? "m";

  if (h > 0) {
    return s > 0 ? `${h}${hSuf}${m}${mSuf}${s}` : `${h}${hSuf}${m}${mSuf}`;
  }
  return s > 0 ? `${m}${mSuf}${s}` : `${m}${mSuf}`;
}

export function insertAfterFirstLine(text: string, insertion: string): string {
  if (!insertion) {
    return text;
  }
  const lines = text.split("\n");
  lines.splice(1, 0, insertion);
  return lines.join("\n");
}

export function formatSpeedComparison(
  currentSpeed: number,
  avgSpeed: number | null,
  t: Locale
): string {
  if (avgSpeed === null || avgSpeed === 0) {
    return "";
  }
  const pctDiff = Math.round(((currentSpeed - avgSpeed) / avgSpeed) * 100);
  const sign = pctDiff >= 0 ? "+" : "";
  return t.session.speedComparison(`${sign}${pctDiff}%`);
}

export function formatSessionConfirmation(
  session: {
    surahStart: number;
    ayahStart: number;
    surahEnd: number;
    ayahEnd: number;
    ayahCount: number;
    durationSeconds: number | null;
    type?: string;
    pageStart?: number | null;
    pageEnd?: number | null;
  },
  t: Locale
): string {
  const startName = getSurahName(session.surahStart, t);
  const endName = getSurahName(session.surahEnd, t);
  const prefix =
    session.type === "extra" ? t.session.extraRecorded : t.session.recorded;

  if (session.durationSeconds == null) {
    if (session.surahStart === session.surahEnd) {
      return `${prefix} ${t.session.confirmationSameSurahNoDuration(startName, session.ayahStart, session.ayahEnd, session.ayahCount)}`;
    }
    return `${prefix} ${t.session.confirmationCrossSurahNoDuration(startName, session.ayahStart, endName, session.ayahEnd, session.ayahCount)}`;
  }

  const duration = formatDuration(session.durationSeconds, t);

  let speedSuffix = "";
  if (session.durationSeconds > 0) {
    if (session.pageStart != null && session.pageEnd != null) {
      const pageCount = effectivePageCount(
        session.pageStart,
        session.pageEnd,
        session.type
      );
      const pagesPerHour = pageCount / (session.durationSeconds / 3600);
      speedSuffix = ` (${t.session.pagesPerHour(pagesPerHour.toFixed(1))})`;
    } else {
      const versetsPerHour = Math.round(
        session.ayahCount / (session.durationSeconds / 3600)
      );
      speedSuffix = ` (${t.session.versesPerHour(versetsPerHour)})`;
    }
  }

  if (session.surahStart === session.surahEnd) {
    return `${prefix} ${t.session.confirmationSameSurah(startName, session.ayahStart, session.ayahEnd, session.ayahCount, duration, speedSuffix)}`;
  }

  return `${prefix} ${t.session.confirmationCrossSurah(startName, session.ayahStart, endName, session.ayahEnd, session.ayahCount, duration, speedSuffix)}`;
}

export function formatHistoryLine(
  session: {
    id: number;
    startedAt: string;
    durationSeconds: number | null;
    surahStart: number;
    ayahStart: number;
    surahEnd: number;
    ayahEnd: number;
    ayahCount: number;
    type?: "normal" | "extra" | "kahf";
    pageStart?: number | null;
    pageEnd?: number | null;
  },
  t: Locale
): string {
  // Parse "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SSZ" manually
  const s = session.startedAt;
  const day = s.slice(8, 10);
  const month = s.slice(5, 7);
  const hour = s.slice(11, 13);
  const minute = s.slice(14, 16);
  const duration = formatDuration(session.durationSeconds, t);

  const range = formatRange(
    session.surahStart,
    session.ayahStart,
    session.surahEnd,
    session.ayahEnd,
    t
  );

  const tp = session.type ?? "normal";
  const tagMap: Record<string, string> = {
    normal: "[N]",
    extra: "[E]",
    kahf: "[K]",
  };
  const tag = tagMap[tp] ?? "[N]";

  let pagesSuffix = "";
  let speedSuffix = "";
  if (session.pageStart != null && session.pageEnd != null) {
    const pageCount = effectivePageCount(
      session.pageStart,
      session.pageEnd,
      session.type
    );
    const displayCount = Math.round(pageCount * 10) / 10;
    pagesSuffix = `, ${t.fmt.pagesCompact(displayCount)}`;
    if (session.durationSeconds != null && session.durationSeconds > 0) {
      const pagesPerHour = pageCount / (session.durationSeconds / 3600);
      speedSuffix = `, ${t.fmt.pagesPerHourCompact(pagesPerHour.toFixed(1))}`;
    }
  } else if (session.durationSeconds != null && session.durationSeconds > 0) {
    const versetsPerHour = Math.round(
      session.ayahCount / (session.durationSeconds / 3600)
    );
    speedSuffix = `, ${t.fmt.versesPerHourCompact(versetsPerHour)}`;
  }

  return `${tag} #${session.id} | ${t.fmt.dateShort(day, month)} ${t.fmt.timeShort(hour, minute)} | ${duration} | ${range} (${session.ayahCount}v${pagesSuffix}${speedSuffix})`;
}

export function formatStats(
  data: {
    totalAyahs: number;
    totalPageSeconds: number;
    totalPages: number;
    totalSeconds: number;
    currentStreak: number;
    bestStreak: number;
    weekAyahs: number;
    weekPageSeconds: number;
    weekPages: number;
    weekSeconds: number;
    monthAyahs: number;
    monthPageSeconds: number;
    monthPages: number;
    monthSeconds: number;
    prevWeekPageSeconds?: number;
    prevWeekPages?: number;
    prevWeekSeconds?: number;
  },
  t: Locale
): string {
  const computeSpeed = (pages: number, pageSeconds: number): number =>
    pageSeconds > 0 ? (pages / pageSeconds) * 3600 : 0;

  const totalDuration = formatDuration(data.totalSeconds, t);
  const speed = computeSpeed(data.totalPages, data.totalPageSeconds);
  const weekDuration = formatDuration(data.weekSeconds, t);
  const monthDuration = formatDuration(data.monthSeconds, t);

  // Week line with optional speed and trend
  let weekLine = `${t.stats.versesLabel} : ${data.weekAyahs} | ${t.stats.durationLabel} : ${weekDuration}`;
  if (data.weekPageSeconds > 0) {
    const weekSpeed = computeSpeed(data.weekPages, data.weekPageSeconds);
    weekLine += ` | ${t.stats.speedLabel} : ${weekSpeed.toFixed(1)} ${t.stats.pagesPerHourShort}`;

    if (
      data.prevWeekPages != null &&
      data.prevWeekPageSeconds != null &&
      data.prevWeekPageSeconds > 0
    ) {
      const prevSpeed = computeSpeed(
        data.prevWeekPages,
        data.prevWeekPageSeconds
      );
      if (prevSpeed > 0) {
        const pct = Math.round(((weekSpeed - prevSpeed) / prevSpeed) * 100);
        const sign = pct >= 0 ? "+" : "";
        weekLine += ` (${t.stats.vsLastWeek(`${sign}${pct}%`)})`;
      }
    }
  }

  // Month line with optional speed
  let monthLine = `${t.stats.versesLabel} : ${data.monthAyahs} | ${t.stats.durationLabel} : ${monthDuration}`;
  if (data.monthPageSeconds > 0) {
    const monthSpeed = computeSpeed(data.monthPages, data.monthPageSeconds);
    monthLine += ` | ${t.stats.speedLabel} : ${monthSpeed.toFixed(1)} ${t.stats.pagesPerHourShort}`;
  }

  return [
    t.stats.title,
    `${t.stats.versesRead} : ${data.totalAyahs}`,
    `${t.stats.totalDuration} : ${totalDuration}`,
    `${t.stats.averageSpeed} : ${speed.toFixed(1)} ${t.stats.pagesPerHourShort}`,
    t.stats.currentStreak(data.currentStreak),
    t.stats.bestStreak(data.bestStreak),
    "",
    t.stats.thisWeek,
    weekLine,
    "",
    t.stats.thisMonth,
    monthLine,
  ].join("\n");
}

export function formatProgress(
  data: {
    totalAyahsRead: number;
    totalAyahs: number;
    nextPage: number | null;
    khatmaCount?: number;
  },
  t: Locale
): string {
  const pct =
    data.totalAyahs > 0 ? (data.totalAyahsRead / data.totalAyahs) * 100 : 0;
  const filled = Math.max(0, Math.min(20, Math.round(pct / 5)));
  const bar = "#".repeat(filled) + "-".repeat(20 - filled);

  const lines = [
    t.progress.label(data.totalAyahsRead, data.totalAyahs, pct.toFixed(1)),
    `[${bar}] ${pct.toFixed(1)}%`,
  ];
  if (data.nextPage != null) {
    lines.push(t.read.nextPage(data.nextPage));
  }

  if (data.khatmaCount) {
    lines.push(t.progress.khatmas(data.khatmaCount));
  }

  return lines.join("\n");
}

export function formatReminder(
  data: {
    nextPage: number;
    weekSessions: number;
    weekAyahs: number;
    streak: number;
  },
  t: Locale
): string {
  const closing =
    data.streak > 0 ? t.reminder.keepItUp : t.reminder.timeToResume;

  return [
    t.reminder.title,
    "",
    t.reminder.nextPage(data.nextPage),
    t.reminder.thisWeek(data.weekSessions, data.weekAyahs),
    t.reminder.streak(data.streak),
    "",
    closing,
  ].join("\n");
}

export function formatReadConfirmation(
  data: {
    pageStart: number;
    pageEnd: number;
    durationSeconds: number | null;
    totalPagesRead: number;
    totalPages: number;
  },
  t: Locale
): string {
  const tail =
    data.pageEnd === data.totalPages
      ? t.read.quranComplete
      : t.read.nextPage(data.pageEnd + 1);
  const progress = `(${data.totalPagesRead}/${data.totalPages})`;

  let line1: string;
  if (data.durationSeconds == null) {
    line1 =
      data.pageStart === data.pageEnd
        ? `${t.read.pageSingularRecorded(data.pageStart)} ${progress}`
        : `${t.read.pagePluralRecorded(data.pageStart, data.pageEnd)} ${progress}`;
  } else {
    const duration = formatDuration(data.durationSeconds, t);
    let speedPart = "";
    if (data.durationSeconds > 0) {
      const pagesPerHour =
        (data.pageEnd - data.pageStart + 1) / (data.durationSeconds / 3600);
      speedPart = ` -- ${t.session.pagesPerHour(pagesPerHour.toFixed(1))}`;
    }
    line1 =
      data.pageStart === data.pageEnd
        ? `${t.read.pageSingularRead(data.pageStart, duration)}${speedPart} ${progress}`
        : `${t.read.pagePluralRead(data.pageStart, data.pageEnd, duration)}${speedPart} ${progress}`;
  }

  return `${line1}\n${tail}`;
}

export function formatKahfPageConfirmation(
  data: {
    kahfPage: number;
    kahfTotal: number;
    durationSeconds: number | null;
    weekPagesRead: number;
    weekTotalSeconds: number;
    isComplete: boolean;
    lastWeekTotalSeconds?: number;
    sessionPages?: number;
  },
  t: Locale
): string {
  const pages = data.sessionPages ?? 1;
  const weekDuration = formatDuration(data.weekTotalSeconds, t);

  if (data.durationSeconds == null) {
    if (!data.isComplete) {
      return `${t.kahf.pageReadNoDuration(data.kahfPage, data.kahfTotal)}\n${t.kahf.thisWeek(data.weekPagesRead, data.kahfTotal, weekDuration)}`;
    }
    return t.kahf.complete(data.kahfPage, data.kahfTotal, weekDuration);
  }

  const duration = formatDuration(data.durationSeconds, t);

  let speedPart = "";
  if (data.durationSeconds > 0) {
    const pagesPerHour = pages / (data.durationSeconds / 3600);
    speedPart = ` -- ${t.session.pagesPerHour(pagesPerHour.toFixed(1))}`;
  }

  if (!data.isComplete) {
    return `${t.kahf.pageRead(data.kahfPage, data.kahfTotal, duration)}${speedPart}\n${t.kahf.thisWeek(data.weekPagesRead, data.kahfTotal, weekDuration)}`;
  }
  const lines: string[] = [
    t.kahf.complete(data.kahfPage, data.kahfTotal, weekDuration),
  ];

  if (data.lastWeekTotalSeconds !== undefined) {
    const lastWeekDuration = formatDuration(data.lastWeekTotalSeconds, t);
    const diff = data.weekTotalSeconds - data.lastWeekTotalSeconds;
    if (diff < 0) {
      const absDiff = formatDuration(Math.abs(diff), t);
      lines.push(t.kahf.lastWeekFaster(lastWeekDuration, absDiff));
    } else if (diff > 0) {
      const absDiff = formatDuration(diff, t);
      lines.push(t.kahf.lastWeekSlower(lastWeekDuration, absDiff));
    } else {
      lines.push(t.kahf.lastWeek(lastWeekDuration));
    }
  }

  return lines.join("\n");
}

export function formatKahfReminder(
  data: {
    lastDate?: string;
    lastDuration?: number;
    nextKahfPage?: number;
  },
  t: Locale
): string {
  const lines: string[] = [t.kahf.reminderBase];
  if (data.lastDate !== undefined && data.lastDuration !== undefined) {
    const day = data.lastDate.slice(8, 10);
    const month = data.lastDate.slice(5, 7);
    const duration = formatDuration(data.lastDuration, t);
    lines.push("");
    lines.push(t.kahf.reminderLast(t.fmt.dateShort(day, month), duration));
  }
  if (data.nextKahfPage !== undefined) {
    lines.push(t.kahf.reminderNextPage(data.nextKahfPage));
  }
  return lines.join("\n");
}

export function formatKhatmaMessage(khatmaNumber: number, t: Locale): string {
  if (khatmaNumber === 1) {
    return t.khatma.first;
  }
  return t.khatma.nth(khatmaNumber);
}

export function formatSurahsComplete(
  surahs: { number: number; name: string; nameAr?: string }[],
  t: Locale
): string {
  const getName = (s: { name: string; nameAr?: string }) =>
    t.lang === "ar" && s.nameAr ? s.nameAr : s.name;
  if (surahs.length === 1) {
    return t.surahComplete.singular(getName(surahs[0]), surahs[0].number);
  }
  const list = surahs.map((s) => `${getName(s)} (${s.number})`).join(", ");
  return t.surahComplete.plural(list);
}

export function appendCompletedSurahs(
  parts: string[],
  surahStart: number,
  ayahStart: number,
  surahEnd: number,
  ayahEnd: number,
  t: Locale
): void {
  const completed = getCompletedSurahs(
    surahStart,
    ayahStart,
    surahEnd,
    ayahEnd
  );
  if (completed.length > 0) {
    parts.push(formatSurahsComplete(completed, t));
  }
}

export function formatSpeedReport(data: SpeedReportData, t: Locale): string {
  const lines: string[] = [t.speed.title, ""];

  if (data.averages.global !== null) {
    lines.push(
      t.speed.globalAverage(formatSpeedOneDecimal(data.averages.global))
    );
  }
  if (data.averages.last7Days !== null) {
    lines.push(
      t.speed.last7Days(formatSpeedOneDecimal(data.averages.last7Days))
    );
  }
  if (data.averages.last30Days !== null) {
    lines.push(
      t.speed.last30Days(formatSpeedOneDecimal(data.averages.last30Days))
    );
  }

  if (data.bestSession || data.longestSession) {
    lines.push("");
    if (data.bestSession) {
      const { pageStart, pageEnd, durationSeconds, type } = data.bestSession;
      if (
        pageStart !== null &&
        pageEnd !== null &&
        durationSeconds != null &&
        durationSeconds > 0
      ) {
        const pages = effectivePageCount(pageStart, pageEnd, type);
        const speedStr = formatSpeedOneDecimal(
          pages / (durationSeconds / 3600)
        );
        const day = data.bestSession.startedAt.slice(8, 10);
        const month = data.bestSession.startedAt.slice(5, 7);
        lines.push(
          t.speed.bestSession(
            data.bestSession.id,
            speedStr,
            t.fmt.dateShort(day, month)
          )
        );
      }
    }
    if (data.longestSession) {
      const duration = formatDuration(data.longestSession.durationSeconds, t);
      const day = data.longestSession.startedAt.slice(8, 10);
      const month = data.longestSession.startedAt.slice(5, 7);
      lines.push(
        t.speed.longestSession(
          data.longestSession.id,
          duration,
          t.fmt.dateShort(day, month)
        )
      );
    }
  }

  if (data.byType.length > 0) {
    lines.push("");
    lines.push(t.speed.byType);
    const typeLabels: Record<string, string> = {
      normal: t.speed.typeNormal,
      extra: t.speed.typeExtra,
      kahf: t.speed.typeKahf,
    };
    const maxLabelLen = Math.max(
      ...data.byType.map((tp) => (typeLabels[tp.type] ?? tp.type).length)
    );
    for (const tp of data.byType) {
      const label = typeLabels[tp.type] ?? tp.type;
      const padded = label.padEnd(maxLabelLen);
      const speedStr = `${formatSpeedOneDecimal(tp.avgSpeed)} ${t.stats.pagesPerHourShort}`;
      lines.push(
        `  ${padded} : ${speedStr} (${t.speed.sessionsCount(tp.sessionCount)})`
      );
    }
  }

  return lines.join("\n");
}

export function formatError(
  description: string,
  t: Locale,
  example?: string
): string {
  if (example) {
    return `${t.error} : ${description}\n${t.example} : ${example}`;
  }
  return `${t.error} : ${description}`;
}

function formatPercentChange(current: number, previous: number): string {
  if (previous === 0) {
    return "";
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) {
    return ` (+${pct}%)`;
  }
  if (pct < 0) {
    return ` (${pct}%)`;
  }
  return "";
}

export function formatWeeklyRecap(data: WeeklyRecapData, t: Locale): string {
  if (data.thisWeek.sessions === 0) {
    return `${t.recap.title}\n\n${t.recap.noSession}`;
  }

  const hasLastWeek = data.lastWeek.sessions > 0;

  const pagesStr = `${t.recap.pagesRead} : ${formatOneDecimalTrimmed(data.thisWeekPages)}${hasLastWeek ? formatPercentChange(data.thisWeekPages, data.lastWeekPages) : ""}`;
  const durationStr = `${t.recap.duration} : ${formatDuration(data.thisWeek.seconds, t)}${hasLastWeek ? formatPercentChange(data.thisWeek.seconds, data.lastWeek.seconds) : ""}`;
  const sessionsStr = `${t.recap.sessions} : ${data.thisWeek.sessions}${hasLastWeek ? formatPercentChange(data.thisWeek.sessions, data.lastWeek.sessions) : ""}`;
  const streakStr = t.recap.streak(data.streak.currentStreak);

  const lines = [
    t.recap.title,
    "",
    pagesStr,
    durationStr,
    sessionsStr,
    streakStr,
  ];

  if (data.completedSurahs.length > 0) {
    lines.push("");
    lines.push(formatSurahsComplete(data.completedSurahs, t));
  }

  return lines.join("\n");
}
