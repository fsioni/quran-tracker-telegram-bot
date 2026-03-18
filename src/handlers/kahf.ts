// src/handlers/kahf.ts
import type { CustomContext } from "../bot";
import { parsePageCountAndDuration, formatKahfPageConfirmation, formatError } from "../services/format";
import { getPageRange, KAHF_PAGE_START, KAHF_PAGE_END, KAHF_TOTAL_PAGES } from "../data/pages";
import { insertSession, getTimezone, getNowTimestamp, getKahfSessionsThisWeek, getLastWeekKahfTotal, calculateKahfPagesRead } from "../services/db";

export async function kahfHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim();
  const parsed = parsePageCountAndDuration(input, "/kahf 5m ou /kahf 3 15m");
  if (!parsed.ok) {
    await ctx.reply(formatError(parsed.error));
    return;
  }
  const { count, durationSeconds } = parsed.value;

  const tz = await getTimezone(ctx.db);

  // Get kahf sessions this week
  const weekSessions = await getKahfSessionsThisWeek(ctx.db, tz);

  // Calculate pages already read this week
  const pagesAlreadyRead = calculateKahfPagesRead(weekSessions);

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

  const now = getNowTimestamp(tz);

  // Insert session with type 'kahf'
  const result = await insertSession(ctx.db, {
    startedAt: now,
    durationSeconds: durationSeconds,
    surahStart: rangeData.surahStart,
    ayahStart: rangeData.ayahStart,
    surahEnd: rangeData.surahEnd,
    ayahEnd: rangeData.ayahEnd,
    ayahCount: rangeData.ayahCount,
    type: "kahf",
    pageStart,
    pageEnd,
  });
  if (!result.ok) {
    await ctx.reply(formatError(result.error));
    return;
  }

  // Calculate week totals including this session
  const weekPagesRead = pagesAlreadyRead + count;
  const weekTotalSeconds =
    weekSessions.reduce((sum, s) => sum + s.durationSeconds, 0) +
    durationSeconds;

  const isComplete = weekPagesRead >= KAHF_TOTAL_PAGES;

  if (isComplete) {
    const lastWeekResult = await getLastWeekKahfTotal(ctx.db, tz);
    if (!lastWeekResult.ok) {
      console.error("getLastWeekKahfTotal failed:", lastWeekResult.error);
    }
    const lastWeekTotalSeconds = lastWeekResult.ok ? lastWeekResult.value : 0;

    await ctx.reply(
      formatKahfPageConfirmation({
        kahfPage: weekPagesRead,
        kahfTotal: KAHF_TOTAL_PAGES,
        durationSeconds: durationSeconds,
        weekPagesRead,
        weekTotalSeconds,
        isComplete: true,
        lastWeekTotalSeconds: lastWeekTotalSeconds > 0 ? lastWeekTotalSeconds : undefined,
        sessionPages: count,
      }),
    );
  } else {
    await ctx.reply(
      formatKahfPageConfirmation({
        kahfPage: weekPagesRead,
        kahfTotal: KAHF_TOTAL_PAGES,
        durationSeconds: durationSeconds,
        weekPagesRead,
        weekTotalSeconds,
        isComplete: false,
        sessionPages: count,
      }),
    );
  }
}
