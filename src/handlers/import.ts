// src/handlers/import.ts
import type { CustomContext } from "../bot";
import { parseImportLine, formatError } from "../services/format";
import { validateRange, calculateAyahCount } from "../services/quran";
import { insertBatch, type InsertSessionData, type SessionType } from "../services/db";

export async function importHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim();

  if (!input) {
    await ctx.reply(
      formatError("aucune donnee a importer", "/import\n10/03, 13h30 - 8m53 - 2:77-83"),
    );
    return;
  }

  const lines = input.split(/\r?\n/).filter((l) => l.trim() !== "");

  let type: SessionType = 'normal';
  let startIndex = 0;

  if (lines.length > 0 && lines[0].toLowerCase() === 'extra') {
    type = 'extra';
    startIndex = 1;
  }

  const valid: InsertSessionData[] = [];
  const errors: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    const parsed = parseImportLine(line);
    if (!parsed.ok) {
      errors.push(`Ligne ${i + 1} : ${parsed.error}`);
      continue;
    }

    const { date, time, duration, range } = parsed.value;
    const { surahStart, ayahStart, surahEnd, ayahEnd } = range;

    const rangeValid = validateRange(surahStart, ayahStart, surahEnd, ayahEnd);
    if (!rangeValid.ok) {
      errors.push(`Ligne ${i + 1} : ${rangeValid.error}`);
      continue;
    }

    const ayahCount = calculateAyahCount(surahStart, ayahStart, surahEnd, ayahEnd);
    valid.push({
      startedAt: `${date} ${time}:00`,
      durationSeconds: duration,
      surahStart,
      ayahStart,
      surahEnd,
      ayahEnd,
      ayahCount,
      type,
    });
  }

  if (valid.length > 0) {
    await insertBatch(ctx.db, valid);
  }

  const s = (n: number) => (n > 1 ? "s" : "");

  let message: string;
  if (valid.length > 0 && errors.length === 0) {
    message = `${valid.length} session${s(valid.length)} importee${s(valid.length)}.`;
  } else if (valid.length > 0) {
    message = `${valid.length} session${s(valid.length)} importee${s(valid.length)}, ${errors.length} erreur${s(errors.length)} :\n${errors.join("\n")}`;
  } else {
    message = `Aucune session importee. ${errors.length} erreur${s(errors.length)} :\n${errors.join("\n")}`;
  }

  await ctx.reply(message);
}
