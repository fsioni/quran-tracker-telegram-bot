// src/handlers/kahf.ts
import type { CustomContext } from "../bot";
import { parseDuration, formatKahfPageConfirmation, formatError } from "../services/format";
import { getPageRange, KAHF_PAGE_START, KAHF_PAGE_END, KAHF_TOTAL_PAGES } from "../data/pages";
import { insertSession, getConfig, getKahfSessionsThisWeek, getLastWeekKahfTotal } from "../services/db";
import { DEFAULT_TZ } from "../config";

export async function kahfHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim();
  if (!input) {
    await ctx.reply(formatError("format invalide", "/kahf 5m ou /kahf 3 15m"));
    return;
  }

  const parts = input.split(/\s+/);

  let count: number;
  let durationStr: string;

  if (parts.length === 1) {
    // /kahf 5m -> 1 page
    count = 1;
    durationStr = parts[0];
  } else {
    // /kahf 3 15m -> 3 pages
    const parsed = parseInt(parts[0], 10);
    if (isNaN(parsed) || parsed < 1) {
      await ctx.reply(formatError("nombre de pages invalide", "/kahf 3 15m"));
      return;
    }
    count = parsed;
    durationStr = parts[1];
  }

  const durationResult = parseDuration(durationStr);
  if (!durationResult.ok) {
    await ctx.reply(formatError(durationResult.error));
    return;
  }

  // Get timezone
  const tz = (await getConfig(ctx.db, "timezone")) ?? DEFAULT_TZ;

  // Get kahf sessions this week
  const weekSessions = await getKahfSessionsThisWeek(ctx.db, tz);

  // Calculate pages already read this week
  const pagesAlreadyRead = weekSessions.reduce((sum, s) => {
    if (s.pageStart !== null && s.pageEnd !== null) {
      return sum + (s.pageEnd - s.pageStart + 1);
    }
    return sum;
  }, 0);

  // Check if already finished Al-Kahf this week
  if (pagesAlreadyRead >= KAHF_TOTAL_PAGES) {
    await ctx.reply("Al-Kahf deja terminee cette semaine !");
    return;
  }

  // Calculate page range
  const pageStart = KAHF_PAGE_START + pagesAlreadyRead;
  const pageEnd = pageStart + count - 1;

  // Check if pageEnd exceeds Al-Kahf
  if (pageEnd > KAHF_PAGE_END) {
    const remaining = KAHF_TOTAL_PAGES - pagesAlreadyRead;
    await ctx.reply(
      formatError(
        `il ne reste que ${remaining} page(s) d'Al-Kahf cette semaine (page ${pageStart} a ${KAHF_PAGE_END})`,
      ),
    );
    return;
  }

  // Get page range data (surah/ayah info)
  const rangeData = getPageRange(pageStart, pageEnd);
  if (!rangeData) {
    await ctx.reply(formatError("pages invalides"));
    return;
  }

  // Get current time in timezone
  const now = new Date()
    .toLocaleString("sv-SE", { timeZone: tz })
    .replace("T", " ")
    .substring(0, 19);

  // Insert session with type 'kahf'
  await insertSession(ctx.db, {
    startedAt: now,
    durationSeconds: durationResult.value,
    surahStart: rangeData.surahStart,
    ayahStart: rangeData.ayahStart,
    surahEnd: rangeData.surahEnd,
    ayahEnd: rangeData.ayahEnd,
    ayahCount: rangeData.ayahCount,
    type: "kahf",
    pageStart,
    pageEnd,
  });

  // Calculate week totals including this session
  const weekPagesRead = pagesAlreadyRead + count;
  const weekTotalSeconds =
    weekSessions.reduce((sum, s) => sum + s.durationSeconds, 0) +
    durationResult.value;

  // kahfPage: the last page read (1-based within Kahf's 12 pages)
  const kahfPage = pagesAlreadyRead + count;

  // Check if Al-Kahf is now complete
  const isComplete = weekPagesRead >= KAHF_TOTAL_PAGES;

  if (isComplete) {
    const lastWeekTotalSeconds = await getLastWeekKahfTotal(ctx.db, tz);

    await ctx.reply(
      formatKahfPageConfirmation({
        kahfPage,
        kahfTotal: KAHF_TOTAL_PAGES,
        durationSeconds: durationResult.value,
        weekPagesRead,
        weekTotalSeconds,
        isComplete: true,
        lastWeekTotalSeconds: lastWeekTotalSeconds > 0 ? lastWeekTotalSeconds : undefined,
      }),
    );
  } else {
    await ctx.reply(
      formatKahfPageConfirmation({
        kahfPage,
        kahfTotal: KAHF_TOTAL_PAGES,
        durationSeconds: durationResult.value,
        weekPagesRead,
        weekTotalSeconds,
        isComplete: false,
      }),
    );
  }
}
