// src/handlers/read.ts
import type { CustomContext } from "../bot";
import { parseDuration, formatReadConfirmation, formatError } from "../services/format";
import { getPageRange, TOTAL_PAGES } from "../data/pages";
import { insertSession, getLastSession, getConfig } from "../services/db";
import { DEFAULT_TZ } from "../config";

export async function readHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim();
  if (!input) {
    await ctx.reply(formatError("format invalide", "/read 5m ou /read 3 15m"));
    return;
  }

  const parts = input.split(/\s+/);

  let count: number;
  let durationStr: string;

  if (parts.length === 1) {
    // /read 5m -> 1 page
    count = 1;
    durationStr = parts[0];
  } else {
    // /read 3 15m -> 3 pages
    const parsed = parseInt(parts[0], 10);
    if (isNaN(parsed) || parsed < 1) {
      await ctx.reply(formatError("nombre de pages invalide", "/read 3 15m"));
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

  // Get timezone
  const tz = (await getConfig(ctx.db, "timezone")) ?? DEFAULT_TZ;
  const now = new Date()
    .toLocaleString("sv-SE", { timeZone: tz })
    .replace("T", " ")
    .substring(0, 19);

  // Insert session
  const session = await insertSession(ctx.db, {
    startedAt: now,
    durationSeconds: durationResult.value,
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
