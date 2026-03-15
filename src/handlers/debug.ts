import type { CustomContext } from "../bot";
import {
  getConfig,
  getPrayerCache,
  getLastSession,
  getGlobalStats,
  getTimezone,
  getTodayInTimezone,
  getNowTimestamp,
} from "../services/db";
import { formatRange } from "../services/format";

export async function debugHandler(ctx: CustomContext): Promise<void> {
  const db = ctx.db;

  // Timezone needed first for today's date
  const tz = await getTimezone(db);
  const today = getTodayInTimezone(tz);
  const nowUtc = new Date().toISOString().substring(0, 19).replace("T", " ");
  const nowLocal = getNowTimestamp(tz);

  // Collect all data in parallel
  const [city, country, chatId, prayerCache, lastSession, globalStats, kahfLast] =
    await Promise.all([
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
  lines.push("-- Config --");
  lines.push(`city       : ${city ?? "—"}`);
  lines.push(`country    : ${country ?? "—"}`);
  lines.push(`timezone   : ${tz}`);
  lines.push(`chat_id    : ${chatId ?? "—"}`);
  lines.push("");

  // -- Cache priere --
  if (prayerCache) {
    lines.push(`-- Cache priere (${today}) --`);
    const status = (sent: number) => (sent ? "envoye" : "en attente");
    lines.push(`fajr       : ${prayerCache.fajr} [${status(prayerCache.fajr_sent)}]`);
    lines.push(`dhuhr      : ${prayerCache.dhuhr} [${status(prayerCache.dhuhr_sent)}]`);
    lines.push(`asr        : ${prayerCache.asr} [${status(prayerCache.asr_sent)}]`);
    lines.push(`maghrib    : ${prayerCache.maghrib} [${status(prayerCache.maghrib_sent)}]`);
    lines.push(`isha       : ${prayerCache.isha} [${status(prayerCache.isha_sent)}]`);
    lines.push(`fetched_at : ${prayerCache.fetched_at}`);
  } else {
    lines.push("-- Cache priere --");
    lines.push("aucun cache");
  }
  lines.push("");

  // -- Derniere session --
  lines.push("-- Derniere session --");
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
    );
    lines.push(`id         : ${lastSession.id}`);
    lines.push(`date       : ${day}/${month} ${hour}h${minute}`);
    lines.push(`type       : ${lastSession.type}`);
    lines.push(`range      : ${range}`);
  } else {
    lines.push("aucune session");
  }
  lines.push("");

  // -- Cron --
  lines.push("-- Cron --");
  lines.push(`kahf_reminder_last : ${kahfLast ?? "—"}`);
  lines.push("");

  // -- DB stats --
  lines.push("-- DB stats --");
  if (globalStats.ok) {
    lines.push(`total sessions : ${globalStats.value.totalSessions}`);
  } else {
    lines.push("erreur stats");
  }
  lines.push("");

  // -- Systeme --
  lines.push("-- Systeme --");
  lines.push(`serveur (UTC) : ${nowUtc}`);
  lines.push(`user (tz)     : ${nowLocal}`);

  const body = lines.join("\n");
  await ctx.reply(`\`\`\`\n${body}\n\`\`\``, { parse_mode: "MarkdownV2" });
}
