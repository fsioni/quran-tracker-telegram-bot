import { Result, ok, err } from "../types";
import { getSurah } from "../data/surahs";
import { TOTAL_PAGES } from "../data/pages";
import { getCompletedSurahs } from "./quran";

export type ParsedRange = {
  surahStart: number;
  ayahStart: number;
  surahEnd: number;
  ayahEnd: number;
};

export type ParsedImportLine = {
  date: string;
  time: string;
  duration: number;
  range: ParsedRange;
};

// --- Parsing functions ---

export function parseDuration(input: string): Result<number> {
  const match = input.match(/^(?:(\d+)h)?(\d+)m(\d+)?$/);
  if (!match) {
    return err(`format de duree invalide '${input}'. Utilise 8m ou 8m53`);
  }
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  return ok(hours * 3600 + minutes * 60 + seconds);
}

export function parseRange(input: string): Result<ParsedRange> {
  // Same surah: 2:77-83
  const sameSurah = input.match(/^(\d+):(\d+)-(\d+)$/);
  if (sameSurah) {
    const surah = parseInt(sameSurah[1], 10);
    return ok({
      surahStart: surah,
      ayahStart: parseInt(sameSurah[2], 10),
      surahEnd: surah,
      ayahEnd: parseInt(sameSurah[3], 10),
    });
  }

  // Cross-surah: 2:280-3:10
  const crossSurah = input.match(/^(\d+):(\d+)-(\d+):(\d+)$/);
  if (crossSurah) {
    return ok({
      surahStart: parseInt(crossSurah[1], 10),
      ayahStart: parseInt(crossSurah[2], 10),
      surahEnd: parseInt(crossSurah[3], 10),
      ayahEnd: parseInt(crossSurah[4], 10),
    });
  }

  return err(`format de plage invalide '${input}'. Utilise 2:77-83 ou 2:280-3:10`);
}

export function parseImportLine(
  line: string,
  referenceYear?: number,
  referenceDate?: Date,
): Result<ParsedImportLine> {
  // Format: JJ/MM, HHhMM - DUREE - RANGE
  const match = line.match(
    /^(\d{2})\/(\d{2}),\s*(\d{1,2})h(\d{2})\s*-\s*(.+?)\s*-\s*(.+)$/,
  );
  if (!match) {
    return err(
      `format de ligne invalide '${line}'. Utilise JJ/MM, HHhMM - DUREE - RANGE`,
    );
  }

  const day = match[1];
  const month = match[2];
  const hour = match[3].padStart(2, "0");
  const minute = match[4];
  const durationStr = match[5].trim();
  const rangeStr = match[6].trim();

  const parsedMonth = parseInt(month, 10);
  const parsedDay = parseInt(day, 10);

  // Validate month/day ranges
  if (parsedMonth < 1 || parsedMonth > 12) {
    return err(`mois invalide '${month}' (1-12)`);
  }

  const now = referenceDate ?? new Date();
  const year = referenceYear ?? now.getFullYear();

  // Validate day against days in month
  const daysInMonth = new Date(year, parsedMonth, 0).getDate();
  if (parsedDay < 1 || parsedDay > daysInMonth) {
    return err(`jour invalide '${day}' pour le mois ${month} (1-${daysInMonth})`);
  }

  // Determine year: if date is in the future relative to referenceDate, use previous year
  const candidateDate = new Date(year, parsedMonth - 1, parsedDay);
  const refDate = new Date(year, now.getMonth(), now.getDate());
  const finalYear = candidateDate > refDate ? year - 1 : year;

  const durationResult = parseDuration(durationStr);
  if (!durationResult.ok) {
    return err(durationResult.error);
  }

  const rangeResult = parseRange(rangeStr);
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

export function parsePage(input: string): Result<{ pageStart: number; pageEnd: number }> {
  const rangeMatch = input.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const pageStart = parseInt(rangeMatch[1], 10);
    const pageEnd = parseInt(rangeMatch[2], 10);
    if (pageStart < 1 || pageStart > TOTAL_PAGES) {
      return err(`page invalide '${pageStart}'. Les pages vont de 1 a ${TOTAL_PAGES}`);
    }
    if (pageEnd < 1 || pageEnd > TOTAL_PAGES) {
      return err(`page invalide '${pageEnd}'. Les pages vont de 1 a ${TOTAL_PAGES}`);
    }
    if (pageStart > pageEnd) {
      return err(`page de debut (${pageStart}) doit etre inferieure ou egale a la page de fin (${pageEnd})`);
    }
    return ok({ pageStart, pageEnd });
  }

  const singleMatch = input.match(/^(\d+)$/);
  if (singleMatch) {
    const page = parseInt(singleMatch[1], 10);
    if (page < 1 || page > TOTAL_PAGES) {
      return err(`page invalide '${page}'. Les pages vont de 1 a ${TOTAL_PAGES}`);
    }
    return ok({ pageStart: page, pageEnd: page });
  }

  return err(`format de page invalide '${input}'. Utilise 300 ou 300-304`);
}

export function parsePageCountAndDuration(
  input: string,
  cmdExample: string,
): Result<{ count: number; durationSeconds: number }> {
  if (!input) {
    return err(`format invalide. Utilise ${cmdExample}`);
  }
  const parts = input.split(/\s+/);
  let count: number;
  let durationStr: string;

  if (parts.length === 1) {
    count = 1;
    durationStr = parts[0];
  } else {
    const parsed = parseInt(parts[0], 10);
    if (isNaN(parsed) || parsed < 1) {
      return err(`nombre de pages invalide. Utilise ${cmdExample}`);
    }
    count = parsed;
    durationStr = parts[1];
  }

  const durationResult = parseDuration(durationStr);
  if (!durationResult.ok) {
    return durationResult as Result<{ count: number; durationSeconds: number }>;
  }

  return ok({ count, durationSeconds: durationResult.value });
}

// --- Formatting functions ---

export function formatRange(
  surahStart: number,
  ayahStart: number,
  surahEnd: number,
  ayahEnd: number,
): string {
  const startName = getSurah(surahStart)?.nameFr ?? `Sourate ${surahStart}`;
  if (surahStart === surahEnd) {
    return `${startName} ${surahStart}:${ayahStart}-${ayahEnd}`;
  }
  const endName = getSurah(surahEnd)?.nameFr ?? `Sourate ${surahEnd}`;
  return `${startName} ${surahStart}:${ayahStart} - ${endName} ${surahEnd}:${ayahEnd}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return s > 0 ? `${h}h${m}m${s}` : `${h}h${m}m`;
  }
  return s > 0 ? `${m}m${s}` : `${m}m`;
}

export function formatSessionConfirmation(session: {
  surahStart: number;
  ayahStart: number;
  surahEnd: number;
  ayahEnd: number;
  ayahCount: number;
  durationSeconds: number;
  type?: string;
}): string {
  const startName = getSurah(session.surahStart)?.nameFr ?? `Sourate ${session.surahStart}`;
  const endName = getSurah(session.surahEnd)?.nameFr ?? `Sourate ${session.surahEnd}`;
  const duration = formatDuration(session.durationSeconds);
  const prefix = session.type === "extra" ? "Session extra enregistree :" : "Session enregistree :";

  if (session.surahStart === session.surahEnd) {
    return `${prefix} sourate ${startName} v.${session.ayahStart} a v.${session.ayahEnd} -- ${session.ayahCount} versets en ${duration}`;
  }

  return `${prefix} sourate ${startName} v.${session.ayahStart} a sourate ${endName} v.${session.ayahEnd} -- ${session.ayahCount} versets en ${duration}`;
}

export function formatHistoryLine(session: {
  id: number;
  startedAt: string;
  durationSeconds: number;
  surahStart: number;
  ayahStart: number;
  surahEnd: number;
  ayahEnd: number;
  ayahCount: number;
  type?: "normal" | "extra" | "kahf";
}): string {
  // Parse "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SSZ" manually
  const s = session.startedAt;
  const day = s.substring(8, 10);
  const month = s.substring(5, 7);
  const hour = s.substring(11, 13);
  const minute = s.substring(14, 16);
  const duration = formatDuration(session.durationSeconds);

  const range = formatRange(session.surahStart, session.ayahStart, session.surahEnd, session.ayahEnd);

  const t = session.type ?? "normal";
  const tagMap: Record<string, string> = { normal: "[N]", extra: "[E]", kahf: "[K]" };
  const tag = tagMap[t] ?? "[N]";

  return `${tag} #${session.id} | ${day}/${month} ${hour}h${minute} | ${duration} | ${range} (${session.ayahCount}v)`;
}

export function formatStats(data: {
  totalAyahs: number;
  totalSeconds: number;
  currentStreak: number;
  bestStreak: number;
  weekAyahs: number;
  weekSeconds: number;
  monthAyahs: number;
  monthSeconds: number;
}): string {
  const totalDuration = formatDuration(data.totalSeconds);
  const speed =
    data.totalSeconds > 0
      ? Math.round((data.totalAyahs / data.totalSeconds) * 3600)
      : 0;
  const weekDuration = formatDuration(data.weekSeconds);
  const monthDuration = formatDuration(data.monthSeconds);

  return [
    "-- Stats globales --",
    `Versets lus : ${data.totalAyahs}`,
    `Duree totale : ${totalDuration}`,
    `Vitesse moyenne : ${speed} versets/heure`,
    `Streak actuel : ${data.currentStreak} jours`,
    `Meilleur streak : ${data.bestStreak} jours`,
    "",
    "-- Cette semaine --",
    `Versets : ${data.weekAyahs} | Duree : ${weekDuration}`,
    "-- Ce mois --",
    `Versets : ${data.monthAyahs} | Duree : ${monthDuration}`,
  ].join("\n");
}

export function formatProgress(data: {
  totalAyahsRead: number;
  totalAyahs: number;
  lastSurah: number;
  lastAyah: number;
  khatmaCount?: number;
}): string {
  const pct = data.totalAyahs > 0 ? (data.totalAyahsRead / data.totalAyahs) * 100 : 0;
  const filled = Math.max(0, Math.min(20, Math.round(pct / 5)));
  const bar = "#".repeat(filled) + "-".repeat(20 - filled);
  const surah = getSurah(data.lastSurah)!;

  const lines = [
    `Progression : ${data.totalAyahsRead} / ${data.totalAyahs} versets (${pct.toFixed(1)}%)`,
    `[${bar}] ${pct.toFixed(1)}%`,
    `Dernier point : sourate ${surah.nameFr} (${data.lastSurah}), verset ${data.lastAyah}`,
  ];

  if (data.khatmaCount) {
    lines.push(`Khatmas : ${data.khatmaCount}`);
  }

  return lines.join("\n");
}

export function formatReminder(data: {
  lastSessionDate: string;
  lastSurahNum: number;
  lastAyah: number;
  weekSessions: number;
  weekAyahs: number;
  streak: number;
}): string {
  // Parse "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SSZ" manually
  const day = data.lastSessionDate.substring(8, 10);
  const month = data.lastSessionDate.substring(5, 7);
  const surah = getSurah(data.lastSurahNum)!;
  const closing =
    data.streak > 0 ? "Continue comme ca !" : "C'est le moment de reprendre !";

  return [
    "Rappel lecture du Coran",
    "",
    `Derniere session : ${day}/${month} - sourate ${surah.nameFr} v.${data.lastAyah}`,
    `Cette semaine : ${data.weekSessions} sessions, ${data.weekAyahs} versets`,
    `Serie : ${data.streak} jours consecutifs`,
    "",
    closing,
  ].join("\n");
}

export function formatReadConfirmation(data: {
  pageStart: number;
  pageEnd: number;
  durationSeconds: number;
  totalPagesRead: number;
  totalPages: number;
}): string {
  const duration = formatDuration(data.durationSeconds);
  const isLastPage = data.pageEnd === data.totalPages;

  if (data.pageStart === data.pageEnd) {
    const line1 = `Page ${data.pageStart} lue en ${duration} (${data.totalPagesRead}/${data.totalPages})`;
    if (isLastPage) {
      return `${line1}\nCoran termine ! Alhamdulillah !`;
    }
    return `${line1}\nProchaine page : ${data.pageEnd + 1}`;
  }

  const line1 = `Pages ${data.pageStart}-${data.pageEnd} lues en ${duration} (${data.totalPagesRead}/${data.totalPages})`;
  if (isLastPage) {
    return `${line1}\nCoran termine ! Alhamdulillah !`;
  }
  return `${line1}\nProchaine page : ${data.pageEnd + 1}`;
}

export function formatKahfPageConfirmation(data: {
  kahfPage: number;
  kahfTotal: number;
  durationSeconds: number;
  weekPagesRead: number;
  weekTotalSeconds: number;
  isComplete: boolean;
  lastWeekTotalSeconds?: number;
}): string {
  const duration = formatDuration(data.durationSeconds);

  if (!data.isComplete) {
    const weekDuration = formatDuration(data.weekTotalSeconds);
    return `Al-Kahf page ${data.kahfPage}/${data.kahfTotal} lue en ${duration}\nCette semaine : ${data.weekPagesRead}/${data.kahfTotal} pages, ${weekDuration} au total`;
  }

  const weekDuration = formatDuration(data.weekTotalSeconds);
  const lines: string[] = [
    `Al-Kahf terminee ! ${data.kahfPage}/${data.kahfTotal} pages en ${weekDuration}`,
  ];

  if (data.lastWeekTotalSeconds !== undefined) {
    const lastWeekDuration = formatDuration(data.lastWeekTotalSeconds);
    const diff = data.weekTotalSeconds - data.lastWeekTotalSeconds;
    if (diff < 0) {
      const absDiff = formatDuration(Math.abs(diff));
      lines.push(`Semaine derniere : ${lastWeekDuration} (-${absDiff}, bravo !)`);
    } else if (diff > 0) {
      const absDiff = formatDuration(diff);
      lines.push(`Semaine derniere : ${lastWeekDuration} (+${absDiff})`);
    } else {
      lines.push(`Semaine derniere : ${lastWeekDuration}`);
    }
  }

  return lines.join("\n");
}

export function formatKahfReminder(data: {
  lastDate?: string;
  lastDuration?: number;
}): string {
  const base = "Rappel : c'est vendredi ! Pense a lire sourate Al-Kahf.";
  if (data.lastDate !== undefined && data.lastDuration !== undefined) {
    const day = data.lastDate.substring(8, 10);
    const month = data.lastDate.substring(5, 7);
    const duration = formatDuration(data.lastDuration);
    return `${base}\n\nDerniere lecture : ${day}/${month} en ${duration}`;
  }
  return base;
}

export function formatKhatmaMessage(khatmaNumber: number): string {
  if (khatmaNumber === 1) {
    return "Khatma ! Tu as termine ta premiere lecture complete du Coran. Alhamdulillah !";
  }
  return `Khatma ! Tu as termine ta ${khatmaNumber}e lecture complete du Coran. Alhamdulillah !`;
}

export function formatSurahsComplete(surahs: { number: number; nameFr: string }[]): string {
  if (surahs.length === 1) {
    return `Sourate ${surahs[0].nameFr} (${surahs[0].number}) terminee !`;
  }
  const list = surahs.map((s) => `${s.nameFr} (${s.number})`).join(", ");
  return `Sourates terminees : ${list}`;
}

export function appendCompletedSurahs(
  parts: string[],
  surahStart: number,
  ayahStart: number,
  surahEnd: number,
  ayahEnd: number,
): void {
  const completed = getCompletedSurahs(surahStart, ayahStart, surahEnd, ayahEnd);
  if (completed.length > 0) {
    parts.push(formatSurahsComplete(completed));
  }
}

export function formatError(description: string, example?: string): string {
  if (example) {
    return `Erreur : ${description}\nExemple : ${example}`;
  }
  return `Erreur : ${description}`;
}
