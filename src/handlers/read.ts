// src/handlers/read.ts
import type { CustomContext } from "../bot";
import { parsePageCountAndDuration, formatReadConfirmation, formatError } from "../services/format";
import { getPageRange, TOTAL_PAGES } from "../data/pages";
import { insertSession, getLastSession, getTimezone, getNowTimestamp } from "../services/db";

export async function readHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim();
  const parsed = parsePageCountAndDuration(input, "/read 5m ou /read 3 15m");
  if (!parsed.ok) {
    await ctx.reply(formatError(parsed.error));
    return;
  }
  const { count, durationSeconds } = parsed.value;

  // Determine current page from last normal session
  const lastSession = await getLastSession(ctx.db, "normal");
  let currentPage: number;
  if (lastSession && lastSession.pageEnd) {
    currentPage = lastSession.pageEnd + 1;
  } else {
    currentPage = 1;
  }

  // Check if already finished the Quran
  if (currentPage > TOTAL_PAGES) {
    await ctx.reply("Tu as termine le Coran ! Alhamdulillah !");
    return;
  }

  const pageStart = currentPage;
  const pageEnd = currentPage + count - 1;

  // Validate pageEnd
  if (pageEnd > TOTAL_PAGES) {
    await ctx.reply(
      formatError(
        `il ne reste que ${TOTAL_PAGES - pageStart + 1} page(s) (page ${pageStart} a ${TOTAL_PAGES})`,
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

  const tz = await getTimezone(ctx.db);
  const now = getNowTimestamp(tz);

  // Insert session
  const session = await insertSession(ctx.db, {
    startedAt: now,
    durationSeconds,
    surahStart: rangeData.surahStart,
    ayahStart: rangeData.ayahStart,
    surahEnd: rangeData.surahEnd,
    ayahEnd: rangeData.ayahEnd,
    ayahCount: rangeData.ayahCount,
    type: "normal",
    pageStart,
    pageEnd,
  });

  await ctx.reply(
    formatReadConfirmation({
      pageStart: session.pageStart!,
      pageEnd: session.pageEnd!,
      durationSeconds: session.durationSeconds,
      totalPagesRead: session.pageEnd!,
      totalPages: TOTAL_PAGES,
    }),
  );
}
