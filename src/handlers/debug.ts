import type { CustomContext } from "../bot";
import {
  getConfig,
  getGlobalStats,
  getLastSession,
  getNowTimestamp,
  getPrayerCache,
  getTimezone,
  getTodayInTimezone,
} from "../services/db";
import { formatRange } from "../services/format";

export async function debugHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const db = ctx.db;

  // Timezone needed first for today's date
  const tz = await getTimezone(db);
  const today = getTodayInTimezone(tz);
  const nowUtc = new Date().toISOString().substring(0, 19).replace("T", " ");
  const nowLocal = getNowTimestamp(tz);

  // Collect all data in parallel
  const [
    city,
    country,
    chatId,
    prayerCache,
    lastSession,
    globalStats,
    kahfLast,
  ] = await Promise.all([
    getConfig(db, "city"),
    getConfig(db, "country"),
    getConfig(db, "chat_id"),
    getPrayerCache(db, today),
    getLastSession(db),
    getGlobalStats(db),
    getConfig(db, "kahf_reminder_last"),
  ]);

  const lines: string[] = [];

  // -- Config --
  lines.push(t.debug.configSection);
  lines.push(`city       : ${city ?? "\u2014"}`);
  lines.push(`country    : ${country ?? "\u2014"}`);
  lines.push(`timezone   : ${tz}`);
  lines.push(`chat_id    : ${chatId ?? "\u2014"}`);
  lines.push("");

  // -- Cache priere --
  if (prayerCache) {
    lines.push(t.debug.prayerCacheDateSection(today));
    const status = (sent: number) => (sent ? t.debug.sent : t.debug.pending);
    lines.push(
      `fajr       : ${prayerCache.fajr} [${status(prayerCache.fajr_sent)}]`
    );
    lines.push(
      `dhuhr      : ${prayerCache.dhuhr} [${status(prayerCache.dhuhr_sent)}]`
    );
    lines.push(
      `asr        : ${prayerCache.asr} [${status(prayerCache.asr_sent)}]`
    );
    lines.push(
      `maghrib    : ${prayerCache.maghrib} [${status(prayerCache.maghrib_sent)}]`
    );
    lines.push(
      `isha       : ${prayerCache.isha} [${status(prayerCache.isha_sent)}]`
    );
    lines.push(`fetched_at : ${prayerCache.fetched_at}`);
  } else {
    lines.push(t.debug.prayerCacheSection);
    lines.push(t.debug.noCache);
  }
  lines.push("");

  // -- Derniere session --
  lines.push(t.debug.lastSessionSection);
  if (lastSession) {
    const s = lastSession.startedAt;
    const day = s.substring(8, 10);
    const month = s.substring(5, 7);
    const hour = s.substring(11, 13);
    const minute = s.substring(14, 16);
    const range = formatRange(
      lastSession.surahStart,
      lastSession.ayahStart,
      lastSession.surahEnd,
      lastSession.ayahEnd,
      t
    );
    lines.push(`id         : ${lastSession.id}`);
    lines.push(
      `date       : ${t.fmt.dateShort(day, month)} ${t.fmt.timeShort(hour, minute)}`
    );
    lines.push(`type       : ${lastSession.type}`);
    lines.push(`range      : ${range}`);
  } else {
    lines.push(t.debug.noSession);
  }
  lines.push("");

  // -- Cron --
  lines.push(t.debug.cronSection);
  lines.push(`kahf_reminder_last : ${kahfLast ?? "\u2014"}`);
  lines.push("");

  // -- DB stats --
  lines.push(t.debug.dbStatsSection);
  if (globalStats.ok) {
    lines.push(`total sessions : ${globalStats.value.totalSessions}`);
  } else {
    lines.push(t.debug.statsError);
  }
  lines.push("");

  // -- Systeme --
  lines.push(t.debug.systemSection);
  lines.push(`serveur (UTC) : ${nowUtc}`);
  lines.push(`user (tz)     : ${nowLocal}`);

  const body = lines.join("\n");
  await ctx.reply(`\`\`\`\n${body}\n\`\`\``, { parse_mode: "MarkdownV2" });
}
