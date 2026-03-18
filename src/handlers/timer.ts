// src/handlers/timer.ts
import { InlineKeyboard } from "grammy";
import type { CustomContext } from "../bot";
import {
  getTimerState,
  setTimerState,
  clearTimerState,
  getTimezone,
  getNowTimestamp,
  getLastSession,
  insertSession,
  getKahfSessionsThisWeek,
  getLastWeekKahfTotal,
  calculateKahfPagesRead,
  type TimerType,
  type TimerState,
  type SessionType,
  type Session,
} from "../services/db";
import {
  parseVerseStart,
  parsePage,
  formatDuration,
  formatError,
  formatReadConfirmation,
  formatSessionConfirmation,
  formatKahfPageConfirmation,
} from "../services/format";
import { validateAyah, validateRange, calculateAyahCount } from "../services/quran";
import { getPageRange, TOTAL_PAGES, KAHF_PAGE_START, KAHF_PAGE_END, KAHF_TOTAL_PAGES } from "../data/pages";

// --- Constants ---

const CALLBACK_TIMER_CONFIRM = "timer_confirm_stop";
const CALLBACK_TIMER_CANCEL = "timer_cancel_stop";
const CALLBACK_TIMER_STOP = "timer_stop";
const MAX_TIMER_SECONDS = 4 * 3600;

export const CALLBACK_TIMER_CONFIRM_RE = /^timer_confirm_stop$/;
export const CALLBACK_TIMER_CANCEL_RE = /^timer_cancel_stop$/;
export const CALLBACK_TIMER_STOP_RE = /^timer_stop$/;

// --- Parsed argument types ---

type ParsedGoArgs =
  | { type: "normal_page" }
  | { type: "normal_verse"; surah: number; ayah: number }
  | { type: "extra_page"; page: number }
  | { type: "extra_verse"; surah: number; ayah: number }
  | { type: "kahf" };

// --- /go handler ---

export async function goHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim();

  // Check if timer already active
  const existing = await getTimerState(ctx.db);
  if (existing) {
    const elapsed = Math.floor((Date.now() - existing.startedEpoch) / 1000);
    await ctx.reply(formatError(`un timer est deja actif depuis ${formatDuration(elapsed)}. Utilise /stop pour l'arreter`));
    return;
  }

  // Parse arguments -> determine type + args
  const parsed = parseGoArgs(input);
  if (typeof parsed === "string") {
    await ctx.reply(formatError(parsed));
    return;
  }

  // Validate starting position
  const tz = await getTimezone(ctx.db);

  if (parsed.type === "normal_page") {
    const lastSession = await getLastSession(ctx.db, "normal");
    const currentPage = lastSession?.pageEnd ? lastSession.pageEnd + 1 : 1;
    if (currentPage > TOTAL_PAGES) {
      await ctx.reply("Tu as termine le Coran ! Alhamdulillah !");
      return;
    }
  } else if (parsed.type === "normal_verse" || parsed.type === "extra_verse") {
    const valid = validateAyah(parsed.surah, parsed.ayah);
    if (!valid.ok) {
      await ctx.reply(formatError(valid.error));
      return;
    }
  } else if (parsed.type === "extra_page") {
    const pageResult = parsePage(String(parsed.page));
    if (!pageResult.ok) {
      await ctx.reply(formatError(pageResult.error));
      return;
    }
  } else if (parsed.type === "kahf") {
    const weekSessions = await getKahfSessionsThisWeek(ctx.db, tz);
    const pagesAlreadyRead = calculateKahfPagesRead(weekSessions);
    if (pagesAlreadyRead >= KAHF_TOTAL_PAGES) {
      await ctx.reply("Al-Kahf deja terminee cette semaine !");
      return;
    }
  }

  // Store timer state
  const now = getNowTimestamp(tz);
  const args = argsToJson(parsed);
  await setTimerState(ctx.db, {
    startedAt: now,
    startedEpoch: Date.now(),
    type: parsed.type,
    args,
    awaitingResponse: false,
  });

  // Reply with context
  const messages: Record<TimerType, string> = {
    normal_page: "Timer demarre ! Lecture normale (pages).",
    normal_verse: `Timer demarre ! Lecture depuis ${input}.`,
    extra_page: `Timer demarre ! Lecture extra page ${"page" in parsed ? parsed.page : ""}.`,
    extra_verse: `Timer demarre ! Lecture extra depuis ${input.substring(6).trim()}.`,
    kahf: "Timer demarre ! Lecture d'Al-Kahf.",
  };

  await ctx.reply(messages[parsed.type], {
    reply_markup: new InlineKeyboard().text("Stop", CALLBACK_TIMER_STOP),
  });
}

function parseGoArgs(input: string): ParsedGoArgs | string {
  if (!input) return { type: "normal_page" };

  if (input === "kahf") return { type: "kahf" };

  if (input.startsWith("extra ")) {
    const rest = input.substring(6).trim();
    const verseResult = parseVerseStart(rest);
    if (verseResult.ok) {
      return { type: "extra_verse", surah: verseResult.value.surah, ayah: verseResult.value.ayah };
    }
    const pageResult = parsePage(rest);
    if (pageResult.ok) {
      return { type: "extra_page", page: pageResult.value.pageStart };
    }
    return "format invalide\nExemple : /go extra 300 ou /go extra 2:77";
  }

  const verseResult = parseVerseStart(input);
  if (verseResult.ok) {
    return { type: "normal_verse", surah: verseResult.value.surah, ayah: verseResult.value.ayah };
  }
  return "format invalide\nExemple : /go ou /go 2:77 ou /go extra 300 ou /go kahf";
}

function argsToJson(parsed: ParsedGoArgs): string {
  if ("surah" in parsed) return JSON.stringify({ surah: parsed.surah, ayah: parsed.ayah });
  if ("page" in parsed) return JSON.stringify({ page: parsed.page });
  return "{}";
}

// --- /stop handler ---

export async function stopHandler(ctx: CustomContext): Promise<void> {
  const input = ((ctx.match as string) || "").trim();

  const state = await getTimerState(ctx.db);
  if (!state) {
    await ctx.reply("Aucun timer actif.");
    return;
  }

  // /stop cancel
  if (input === "cancel") {
    await clearTimerState(ctx.db);
    await ctx.reply("Timer annule.");
    return;
  }

  // If already awaiting response, remind the question
  if (state.awaitingResponse) {
    await ctx.reply(getQuestionForType(state.type, state.durationSeconds!));
    return;
  }

  // Calculate duration
  const durationSeconds = Math.floor((Date.now() - state.startedEpoch) / 1000);

  // If > 4h, ask confirmation (capture duration for later use)
  if (durationSeconds > MAX_TIMER_SECONDS) {
    const keyboard = new InlineKeyboard()
      .text("Oui", CALLBACK_TIMER_CONFIRM)
      .text("Non", CALLBACK_TIMER_CANCEL);
    // Store duration now so confirmation callback uses time-of-stop, not time-of-click
    await setTimerState(ctx.db, { ...state, durationSeconds });
    await ctx.reply(
      `Le timer tourne depuis ${formatDuration(durationSeconds)} (plus de 4h). Confirmer l'arret ?`,
      { reply_markup: keyboard },
    );
    return;
  }

  // Proceed: store awaiting + duration, ask question
  await setTimerState(ctx.db, {
    ...state,
    awaitingResponse: true,
    durationSeconds,
  });

  await ctx.reply(getQuestionForType(state.type, durationSeconds));
}

function getQuestionForType(type: TimerType, durationSeconds: number): string {
  const dur = formatDuration(durationSeconds);
  switch (type) {
    case "normal_page":
    case "extra_page":
      return `Session arretee (${dur})\nCombien de pages as-tu lues ?`;
    case "normal_verse":
    case "extra_verse":
      return `Session arretee (${dur})\nJusqu'ou as-tu lu ? (ex: 2:83 ou 3:10)`;
    case "kahf":
      return `Session arretee (${dur})\nCombien de pages d'Al-Kahf as-tu lues ?`;
  }
}

// --- Callbacks for 4h confirmation ---

export async function confirmTimerStopCallback(ctx: CustomContext): Promise<void> {
  const state = await getTimerState(ctx.db);
  if (!state) {
    await ctx.editMessageText("Timer introuvable.");
    await ctx.answerCallbackQuery();
    return;
  }

  // Use duration captured at /stop time (not now)
  const durationSeconds = state.durationSeconds ?? Math.floor((Date.now() - state.startedEpoch) / 1000);
  await setTimerState(ctx.db, {
    ...state,
    awaitingResponse: true,
    durationSeconds,
  });

  await ctx.editMessageText(getQuestionForType(state.type, durationSeconds));
  await ctx.answerCallbackQuery();
}

export async function cancelTimerStopCallback(ctx: CustomContext): Promise<void> {
  await clearTimerState(ctx.db);
  await ctx.editMessageText("Timer annule.");
  await ctx.answerCallbackQuery();
}

// --- Callback for inline Stop button ---

export async function stopTimerCallback(ctx: CustomContext): Promise<void> {
  const state = await getTimerState(ctx.db);
  if (!state) {
    await ctx.editMessageText("Aucun timer actif.");
    await ctx.answerCallbackQuery();
    return;
  }

  if (state.awaitingResponse) {
    await ctx.answerCallbackQuery({ text: "Timer deja arrete." });
    return;
  }

  const durationSeconds = Math.floor((Date.now() - state.startedEpoch) / 1000);

  if (durationSeconds > MAX_TIMER_SECONDS) {
    const keyboard = new InlineKeyboard()
      .text("Oui", CALLBACK_TIMER_CONFIRM)
      .text("Non", CALLBACK_TIMER_CANCEL);
    await setTimerState(ctx.db, { ...state, durationSeconds });
    await ctx.editMessageText(
      `Le timer tourne depuis ${formatDuration(durationSeconds)} (plus de 4h). Confirmer l'arret ?`,
      { reply_markup: keyboard },
    );
    await ctx.answerCallbackQuery();
    return;
  }

  await setTimerState(ctx.db, {
    ...state,
    awaitingResponse: true,
    durationSeconds,
  });

  await ctx.editMessageText(getQuestionForType(state.type, durationSeconds));
  await ctx.answerCallbackQuery();
}

// --- Shared response helpers ---

function parsePageCount(text: string): number | null {
  const count = parseInt(text, 10);
  return isNaN(count) || count < 1 ? null : count;
}

async function handlePageResponse(
  ctx: CustomContext,
  state: TimerState,
  trimmed: string,
  sessionType: SessionType,
  pageStart: number,
  maxPage: number,
  overflowMsg: (pageEnd: number) => string,
  formatReply: (session: Session, pageStart: number, pageEnd: number, duration: number) => string,
): Promise<void> {
  const count = parsePageCount(trimmed);
  if (!count) {
    await ctx.reply(formatError("nombre de pages invalide. Envoie un nombre (ex: 3) ou /stop cancel pour annuler"));
    return;
  }
  const pageEnd = pageStart + count - 1;
  if (pageEnd > maxPage) {
    await ctx.reply(formatError(overflowMsg(pageEnd)));
    return;
  }
  const rangeData = getPageRange(pageStart, pageEnd);
  if (!rangeData) {
    await ctx.reply(formatError("pages invalides"));
    return;
  }
  const result = await insertSession(ctx.db, {
    startedAt: state.startedAt,
    durationSeconds: state.durationSeconds!,
    surahStart: rangeData.surahStart,
    ayahStart: rangeData.ayahStart,
    surahEnd: rangeData.surahEnd,
    ayahEnd: rangeData.ayahEnd,
    ayahCount: rangeData.ayahCount,
    type: sessionType,
    pageStart,
    pageEnd,
  });
  if (!result.ok) {
    await ctx.reply(formatError(result.error));
    return;
  }
  await Promise.all([
    clearTimerState(ctx.db),
    ctx.reply(formatReply(result.value, pageStart, pageEnd, state.durationSeconds!)),
  ]);
}

async function handleVerseResponse(
  ctx: CustomContext,
  state: TimerState,
  trimmed: string,
  sessionType: SessionType,
): Promise<void> {
  const endResult = parseVerseStart(trimmed);
  if (!endResult.ok) {
    await ctx.reply(formatError("format de verset invalide. Envoie ex: 2:83 ou /stop cancel pour annuler"));
    return;
  }
  const parsedArgs = JSON.parse(state.args);
  const { surah: surahStart, ayah: ayahStart } = parsedArgs;
  const { surah: surahEnd, ayah: ayahEnd } = endResult.value;
  const validResult = validateRange(surahStart, ayahStart, surahEnd, ayahEnd);
  if (!validResult.ok) {
    await ctx.reply(formatError(validResult.error));
    return;
  }
  const ayahCount = calculateAyahCount(surahStart, ayahStart, surahEnd, ayahEnd);
  const result = await insertSession(ctx.db, {
    startedAt: state.startedAt,
    durationSeconds: state.durationSeconds!,
    surahStart,
    ayahStart,
    surahEnd,
    ayahEnd,
    ayahCount,
    type: sessionType,
  });
  if (!result.ok) {
    await ctx.reply(formatError(result.error));
    return;
  }
  await Promise.all([
    clearTimerState(ctx.db),
    ctx.reply(formatSessionConfirmation({ ...result.value, type: sessionType })),
  ]);
}

// --- Middleware: timerResponseHandler ---

export async function timerResponseHandler(
  ctx: CustomContext,
  next: () => Promise<void>,
): Promise<void> {
  // Only intercept plain text messages (not commands)
  const text = ctx.message?.text;
  if (!text || text.startsWith("/")) {
    return next();
  }

  const state = await getTimerState(ctx.db);
  if (!state || !state.awaitingResponse) {
    return next();
  }

  const trimmed = text.trim();
  const tz = await getTimezone(ctx.db);

  try {
    switch (state.type) {
      case "normal_page": {
        const lastSession = await getLastSession(ctx.db, "normal");
        const pageStart = lastSession?.pageEnd ? lastSession.pageEnd + 1 : 1;
        return handlePageResponse(ctx, state, trimmed, "normal", pageStart, TOTAL_PAGES,
          () => `il ne reste que ${TOTAL_PAGES - pageStart + 1} page(s) (page ${pageStart} a ${TOTAL_PAGES})`,
          (_r, ps, pe, dur) => formatReadConfirmation({ pageStart: ps, pageEnd: pe, durationSeconds: dur, totalPagesRead: pe, totalPages: TOTAL_PAGES }),
        );
      }

      case "extra_page": {
        const parsedArgs = JSON.parse(state.args);
        return handlePageResponse(ctx, state, trimmed, "extra", parsedArgs.page, TOTAL_PAGES,
          (pe) => `depassement: pages ${parsedArgs.page}-${pe} (max ${TOTAL_PAGES})`,
          (s) => formatSessionConfirmation({ ...s, type: "extra" }),
        );
      }

      case "normal_verse":
        return handleVerseResponse(ctx, state, trimmed, "normal");

      case "extra_verse":
        return handleVerseResponse(ctx, state, trimmed, "extra");

      case "kahf": {
        const count = parsePageCount(trimmed);
        if (!count) {
          await ctx.reply(formatError("nombre de pages invalide. Envoie un nombre (ex: 3) ou /stop cancel pour annuler"));
          return;
        }
        const weekSessions = await getKahfSessionsThisWeek(ctx.db, tz);
        const pagesAlreadyRead = calculateKahfPagesRead(weekSessions);
        const pageStart = KAHF_PAGE_START + pagesAlreadyRead;
        const pageEnd = pageStart + count - 1;
        if (pageEnd > KAHF_PAGE_END) {
          const remaining = KAHF_TOTAL_PAGES - pagesAlreadyRead;
          await ctx.reply(formatError(`il ne reste que ${remaining} page(s) d'Al-Kahf cette semaine`));
          return;
        }
        const rangeData = getPageRange(pageStart, pageEnd);
        if (!rangeData) {
          await ctx.reply(formatError("pages invalides"));
          return;
        }
        const result = await insertSession(ctx.db, {
          startedAt: state.startedAt,
          durationSeconds: state.durationSeconds!,
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
        await clearTimerState(ctx.db);

        // Calculate week totals
        const weekPagesRead = pagesAlreadyRead + count;
        const weekTotalSeconds =
          weekSessions.reduce((sum, s) => sum + s.durationSeconds, 0) +
          state.durationSeconds!;
        const isComplete = weekPagesRead >= KAHF_TOTAL_PAGES;

        if (isComplete) {
          const lastWeekResult = await getLastWeekKahfTotal(ctx.db, tz);
          const lastWeekTotalSeconds = lastWeekResult.ok ? lastWeekResult.value : 0;
          await ctx.reply(
            formatKahfPageConfirmation({
              kahfPage: weekPagesRead,
              kahfTotal: KAHF_TOTAL_PAGES,
              durationSeconds: state.durationSeconds!,
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
              durationSeconds: state.durationSeconds!,
              weekPagesRead,
              weekTotalSeconds,
              isComplete: false,
              sessionPages: count,
            }),
          );
        }
        return;
      }
    }
  } catch (e) {
    console.error("timerResponseHandler error:", e);
    await ctx.reply(formatError("erreur interne lors du traitement de la reponse"));
  }
}
