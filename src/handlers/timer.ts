// src/handlers/timer.ts
import { InlineKeyboard } from "grammy";
import type { CustomContext } from "../bot";
import { MAX_TIMER_SECONDS } from "../config";
import {
  effectivePageCount,
  getNextKahfPage,
  getNextPage,
  getPageRange,
  KAHF_PAGE_END,
  KAHF_TOTAL_PAGES,
  TOTAL_PAGES,
} from "../data/pages";
import type { Locale } from "../locales/types";
import { getNowTimestamp, getTimezone } from "../services/db/date-helpers";
import {
  calculateKahfPagesRead,
  getKahfSessionsThisWeek,
  getLastWeekKahfTotal,
} from "../services/db/kahf";
import { getLastSession, insertSession } from "../services/db/sessions";
import { get7DayTypeAvgSpeed } from "../services/db/speed";
import {
  clearTimerState,
  getTimerState,
  setTimerState,
} from "../services/db/timer";
import type {
  Session,
  SessionType,
  TimerState,
  TimerType,
} from "../services/db/types";
import {
  formatDuration,
  formatError,
  formatKahfPageConfirmation,
  formatReadConfirmation,
  formatSessionConfirmation,
  formatSpeedComparison,
  insertAfterFirstLine,
  parsePage,
  parseVerseStart,
} from "../services/format";
import {
  calculateAyahCount,
  validateAyah,
  validateRange,
} from "../services/quran";

// --- Constants ---

const CALLBACK_TIMER_CONFIRM = "timer_confirm_stop";
const CALLBACK_TIMER_CANCEL = "timer_cancel_stop";
const CALLBACK_TIMER_STOP = "timer_stop";
export const CALLBACK_TIMER_GO = "timer_go";

export const CALLBACK_TIMER_CONFIRM_RE = /^timer_confirm_stop$/;
export const CALLBACK_TIMER_CANCEL_RE = /^timer_cancel_stop$/;
export const CALLBACK_TIMER_STOP_RE = /^timer_stop$/;
export const CALLBACK_TIMER_GO_RE = /^timer_go$/;
export const CALLBACK_PAGES_RE = /^pages:(\d+)$/;
const CALLBACK_PAGES_OTHER = "pages:other";
export const CALLBACK_PAGES_OTHER_RE = /^pages:other$/;

// --- Parsed argument types ---

type ParsedGoArgs =
  | { type: "normal_page" }
  | { type: "normal_verse"; surah: number; ayah: number }
  | { type: "extra_page"; page: number }
  | { type: "extra_verse"; surah: number; ayah: number }
  | { type: "kahf" };

// --- /go handler ---

export async function goHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim().toLowerCase();

  // No args => normal_page, use shared logic
  if (!input) {
    return executeTimerGoNormalPage(ctx.db, (...args) => ctx.reply(...args), t);
  }

  // Check if timer already active
  const existing = await getTimerState(ctx.db);
  if (existing) {
    const elapsed = Math.floor((Date.now() - existing.startedEpoch) / 1000);
    await ctx.reply(
      formatError(t.timer.alreadyActive(formatDuration(elapsed, t)), t)
    );
    return;
  }

  // Parse arguments -> determine type + args
  const parsed = parseGoArgs(input, t);
  if (typeof parsed === "string") {
    await ctx.reply(formatError(parsed, t));
    return;
  }

  // Validate starting position
  const tz = await getTimezone(ctx.db);

  if (parsed.type === "normal_verse" || parsed.type === "extra_verse") {
    const valid = validateAyah(parsed.surah, parsed.ayah, t);
    if (!valid.ok) {
      await ctx.reply(formatError(valid.error, t));
      return;
    }
  } else if (parsed.type === "extra_page") {
    const pageResult = parsePage(String(parsed.page), t);
    if (!pageResult.ok) {
      await ctx.reply(formatError(pageResult.error, t));
      return;
    }
  } else if (parsed.type === "kahf") {
    const weekSessions = await getKahfSessionsThisWeek(ctx.db, tz);
    const pagesAlreadyRead = calculateKahfPagesRead(weekSessions);
    if (pagesAlreadyRead >= KAHF_TOTAL_PAGES) {
      await ctx.reply(t.kahf.alreadyComplete);
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
    normal_page: t.timer.startedNormalPage,
    normal_verse: t.timer.startedNormalVerse(input),
    extra_page: t.timer.startedExtraPage(
      "page" in parsed ? String(parsed.page) : ""
    ),
    extra_verse: t.timer.startedExtraVerse(input.slice(6).trim()),
    kahf: t.timer.startedKahf,
  };

  await ctx.reply(messages[parsed.type], {
    reply_markup: new InlineKeyboard().text(t.timer.stop, CALLBACK_TIMER_STOP),
  });
}

function parseGoArgs(input: string, t: Locale): ParsedGoArgs | string {
  if (!input) {
    return { type: "normal_page" };
  }

  if (input === "kahf") {
    return { type: "kahf" };
  }

  if (input.startsWith("extra ")) {
    const rest = input.slice(6).trim();
    const verseResult = parseVerseStart(rest, t);
    if (verseResult.ok) {
      return {
        type: "extra_verse",
        surah: verseResult.value.surah,
        ayah: verseResult.value.ayah,
      };
    }
    const pageResult = parsePage(rest, t);
    if (pageResult.ok) {
      return { type: "extra_page", page: pageResult.value.pageStart };
    }
    return t.timer.invalidGoExtraFormat;
  }

  const verseResult = parseVerseStart(input, t);
  if (verseResult.ok) {
    return {
      type: "normal_verse",
      surah: verseResult.value.surah,
      ayah: verseResult.value.ayah,
    };
  }
  return t.timer.invalidGoFormat;
}

function argsToJson(parsed: ParsedGoArgs): string {
  if ("surah" in parsed) {
    return JSON.stringify({ surah: parsed.surah, ayah: parsed.ayah });
  }
  if ("page" in parsed) {
    return JSON.stringify({ page: parsed.page });
  }
  return "{}";
}

// --- Page inline keyboard helpers ---

function isPageBasedType(type: TimerType): boolean {
  return type === "normal_page" || type === "extra_page" || type === "kahf";
}

function buildPageCountKeyboard(t: Locale): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 1; i <= 5; i++) {
    kb.text(String(i), `pages:${i}`);
  }
  kb.row();
  kb.text(t.timer.other, CALLBACK_PAGES_OTHER);
  kb.text(t.manage.cancel, CALLBACK_TIMER_CANCEL);
  return kb;
}

// --- Shared stop logic ---

type SendFn = (
  ...args: [text: string, opts?: { reply_markup?: InlineKeyboard }]
) => Promise<unknown>;

async function executeTimerStop(
  db: D1Database,
  send: SendFn,
  t: Locale
): Promise<void> {
  const state = await getTimerState(db);
  if (!state) {
    await send(t.timer.noActiveTimer);
    return;
  }

  if (state.awaitingResponse) {
    const question = getQuestionForType(
      state.type,
      state.durationSeconds ?? 0,
      t
    );
    const opts = isPageBasedType(state.type)
      ? { reply_markup: buildPageCountKeyboard(t) }
      : undefined;
    await send(question, opts);
    return;
  }

  const durationSeconds = Math.floor((Date.now() - state.startedEpoch) / 1000);

  if (durationSeconds > MAX_TIMER_SECONDS) {
    const keyboard = new InlineKeyboard()
      .text(t.timer.yes, CALLBACK_TIMER_CONFIRM)
      .text(t.timer.no, CALLBACK_TIMER_CANCEL);
    await setTimerState(db, { ...state, durationSeconds });
    await send(t.timer.confirmLongTimer(formatDuration(durationSeconds, t)), {
      reply_markup: keyboard,
    });
    return;
  }

  await setTimerState(db, {
    ...state,
    awaitingResponse: true,
    durationSeconds,
  });

  const question = getQuestionForType(state.type, durationSeconds, t);
  const opts = isPageBasedType(state.type)
    ? { reply_markup: buildPageCountKeyboard(t) }
    : undefined;
  await send(question, opts);
}

// --- /stop handler ---

export async function stopHandler(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const input = ((ctx.match as string) || "").trim().toLowerCase();

  // /stop cancel
  if (input === "cancel") {
    const state = await getTimerState(ctx.db);
    if (!state) {
      await ctx.reply(t.timer.noActiveTimer);
      return;
    }
    await clearTimerState(ctx.db);
    await ctx.reply(t.timer.cancelled);
    return;
  }

  await executeTimerStop(ctx.db, (...args) => ctx.reply(...args), t);
}

function getQuestionForType(
  type: TimerType,
  durationSeconds: number,
  t: Locale
): string {
  const dur = formatDuration(durationSeconds, t);
  switch (type) {
    case "normal_page":
    case "extra_page":
      return t.timer.questionPages(dur);
    case "normal_verse":
    case "extra_verse":
      return t.timer.questionVerses(dur);
    case "kahf":
      return t.timer.questionKahfPages(dur);
    default:
      return t.timer.questionPages(dur);
  }
}

// --- Callbacks for 4h confirmation ---

export async function confirmTimerStopCallback(
  ctx: CustomContext
): Promise<void> {
  const t = ctx.locale;
  const state = await getTimerState(ctx.db);
  if (!state) {
    await ctx.editMessageText(t.timer.notFound);
    await ctx.answerCallbackQuery();
    return;
  }

  // Use duration captured at /stop time (not now)
  const durationSeconds =
    state.durationSeconds ??
    Math.floor((Date.now() - state.startedEpoch) / 1000);
  await setTimerState(ctx.db, {
    ...state,
    awaitingResponse: true,
    durationSeconds,
  });

  const question = getQuestionForType(state.type, durationSeconds, t);
  const opts = isPageBasedType(state.type)
    ? { reply_markup: buildPageCountKeyboard(t) }
    : undefined;
  await ctx.editMessageText(question, opts);
  await ctx.answerCallbackQuery();
}

export async function cancelTimerStopCallback(
  ctx: CustomContext
): Promise<void> {
  const t = ctx.locale;
  await clearTimerState(ctx.db);
  await ctx.editMessageText(t.timer.cancelled);
  await ctx.answerCallbackQuery();
}

// --- Callback for inline Stop button ---

export async function stopTimerCallback(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  await executeTimerStop(ctx.db, (...args) => ctx.editMessageText(...args), t);
  await ctx.answerCallbackQuery();
}

// --- Shared go logic (normal_page, no args) ---

async function executeTimerGoNormalPage(
  db: D1Database,
  send: SendFn,
  t: Locale
): Promise<void> {
  const existing = await getTimerState(db);
  if (existing) {
    const elapsed = Math.floor((Date.now() - existing.startedEpoch) / 1000);
    await send(
      formatError(t.timer.alreadyActive(formatDuration(elapsed, t)), t)
    );
    return;
  }

  const lastSession = await getLastSession(db, "normal");
  if (lastSession?.pageEnd === TOTAL_PAGES) {
    await send(t.timer.quranFinished);
    return;
  }

  const tz = await getTimezone(db);
  const now = getNowTimestamp(tz);
  await setTimerState(db, {
    startedAt: now,
    startedEpoch: Date.now(),
    type: "normal_page",
    args: "{}",
    awaitingResponse: false,
  });

  await send(t.timer.startedNormalPage, {
    reply_markup: new InlineKeyboard().text(t.timer.stop, CALLBACK_TIMER_STOP),
  });
}

// --- Callback for inline Go button (prayer reminder) ---

export async function goTimerCallback(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  await executeTimerGoNormalPage(
    ctx.db,
    (...args) => ctx.editMessageText(...args),
    t
  );
  await ctx.answerCallbackQuery();
}

// --- Shared response helpers ---

function parsePageCount(text: string): number | null {
  const count = Number.parseInt(text, 10);
  return Number.isNaN(count) || count < 1 ? null : count;
}

async function handlePageResponse(
  ctx: CustomContext,
  state: TimerState,
  trimmed: string,
  sessionType: SessionType,
  pageStart: number,
  maxPage: number,
  overflowMsg: (pageEnd: number) => string,
  formatReply: (
    session: Session,
    pageStart: number,
    pageEnd: number,
    duration: number
  ) => string,
  tz: string
): Promise<void> {
  const t = ctx.locale;
  const count = parsePageCount(trimmed);
  if (!count) {
    await ctx.reply(formatError(t.timer.invalidPageCount, t));
    return;
  }
  const pageEnd = pageStart + count - 1;
  if (pageEnd > maxPage) {
    await ctx.reply(formatError(overflowMsg(pageEnd), t));
    return;
  }
  const rangeData = getPageRange(pageStart, pageEnd);
  if (!rangeData) {
    await ctx.reply(formatError(t.read.pagesInvalid, t));
    return;
  }
  const durationSeconds = state.durationSeconds ?? 0;
  const result = await insertSession(ctx.db, {
    startedAt: state.startedAt,
    durationSeconds,
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
    await ctx.reply(formatError(result.error, t));
    return;
  }

  const replyBase = formatReply(
    result.value,
    pageStart,
    pageEnd,
    durationSeconds
  );

  if (durationSeconds > 0) {
    const [avg] = await Promise.all([
      get7DayTypeAvgSpeed(ctx.db, sessionType, tz, result.value.id),
      clearTimerState(ctx.db),
    ]);
    const currentSpeed =
      effectivePageCount(pageStart, pageEnd, sessionType) /
      (durationSeconds / 3600);
    const comparison = formatSpeedComparison(currentSpeed, avg.pagesPerHour, t);
    await ctx.reply(insertAfterFirstLine(replyBase, comparison));
  } else {
    await Promise.all([clearTimerState(ctx.db), ctx.reply(replyBase)]);
  }
}

async function handleVerseResponse(
  ctx: CustomContext,
  state: TimerState,
  trimmed: string,
  sessionType: SessionType,
  tz: string
): Promise<void> {
  const t = ctx.locale;
  const endResult = parseVerseStart(trimmed, t);
  if (!endResult.ok) {
    await ctx.reply(formatError(t.timer.invalidVerseFormat, t));
    return;
  }
  const parsedArgs = JSON.parse(state.args);
  const { surah: surahStart, ayah: ayahStart } = parsedArgs;
  const { surah: surahEnd, ayah: ayahEnd } = endResult.value;
  const validResult = validateRange(
    surahStart,
    ayahStart,
    surahEnd,
    ayahEnd,
    t
  );
  if (!validResult.ok) {
    await ctx.reply(formatError(validResult.error, t));
    return;
  }
  const ayahCount = calculateAyahCount(
    surahStart,
    ayahStart,
    surahEnd,
    ayahEnd
  );
  const durationSeconds = state.durationSeconds ?? 0;
  const result = await insertSession(ctx.db, {
    startedAt: state.startedAt,
    durationSeconds,
    surahStart,
    ayahStart,
    surahEnd,
    ayahEnd,
    ayahCount,
    type: sessionType,
  });
  if (!result.ok) {
    await ctx.reply(formatError(result.error, t));
    return;
  }

  const replyBase = formatSessionConfirmation(
    { ...result.value, type: sessionType },
    t
  );

  if (durationSeconds > 0) {
    const [avg] = await Promise.all([
      get7DayTypeAvgSpeed(ctx.db, sessionType, tz, result.value.id),
      clearTimerState(ctx.db),
    ]);
    const currentSpeed = ayahCount / (durationSeconds / 3600);
    const comparison = formatSpeedComparison(
      currentSpeed,
      avg.versesPerHour,
      t
    );
    await ctx.reply(comparison ? `${replyBase}\n${comparison}` : replyBase);
  } else {
    await Promise.all([clearTimerState(ctx.db), ctx.reply(replyBase)]);
  }
}

// --- Kahf response handler (extracted for complexity) ---

async function handleKahfResponse(
  ctx: CustomContext,
  state: TimerState,
  trimmed: string,
  tz: string
): Promise<void> {
  const t = ctx.locale;
  const count = parsePageCount(trimmed);
  if (!count) {
    await ctx.reply(formatError(t.timer.invalidPageCount, t));
    return;
  }
  const weekSessions = await getKahfSessionsThisWeek(ctx.db, tz);
  const pagesAlreadyRead = calculateKahfPagesRead(weekSessions);
  const pageStart = getNextKahfPage(pagesAlreadyRead);
  if (pageStart === undefined) {
    await ctx.reply(t.kahf.alreadyComplete);
    return;
  }
  const pageEnd = pageStart + count - 1;
  if (pageEnd > KAHF_PAGE_END) {
    const remaining = KAHF_TOTAL_PAGES - pagesAlreadyRead;
    await ctx.reply(
      formatError(t.kahf.remainingPages(remaining, pageStart, KAHF_PAGE_END), t)
    );
    return;
  }
  const rangeData = getPageRange(pageStart, pageEnd, "kahf");
  if (!rangeData) {
    await ctx.reply(formatError(t.read.pagesInvalid, t));
    return;
  }
  const durationSec = state.durationSeconds ?? 0;
  const result = await insertSession(ctx.db, {
    startedAt: state.startedAt,
    durationSeconds: durationSec,
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
    await ctx.reply(formatError(result.error, t));
    return;
  }

  const weekPagesRead = pagesAlreadyRead + count;
  const weekTotalSeconds =
    weekSessions.reduce((sum, s) => sum + s.durationSeconds, 0) + durationSec;
  const isComplete = weekPagesRead >= KAHF_TOTAL_PAGES;
  const sessionPages = effectivePageCount(pageStart, pageEnd, "kahf");

  let comparison = "";
  if (durationSec > 0) {
    const [avg] = await Promise.all([
      get7DayTypeAvgSpeed(ctx.db, "kahf", tz, result.value.id),
      clearTimerState(ctx.db),
    ]);
    const currentSpeed = sessionPages / (durationSec / 3600);
    comparison = formatSpeedComparison(currentSpeed, avg.pagesPerHour, t);
  } else {
    await clearTimerState(ctx.db);
  }

  if (isComplete) {
    const lastWeekResult = await getLastWeekKahfTotal(ctx.db, tz);
    const lastWeekTotalSeconds = lastWeekResult.ok ? lastWeekResult.value : 0;
    await ctx.reply(
      insertAfterFirstLine(
        formatKahfPageConfirmation(
          {
            kahfPage: weekPagesRead,
            kahfTotal: KAHF_TOTAL_PAGES,
            durationSeconds: durationSec,
            weekPagesRead,
            weekTotalSeconds,
            isComplete: true,
            lastWeekTotalSeconds:
              lastWeekTotalSeconds > 0 ? lastWeekTotalSeconds : undefined,
            sessionPages,
          },
          t
        ),
        comparison
      )
    );
  } else {
    await ctx.reply(
      insertAfterFirstLine(
        formatKahfPageConfirmation(
          {
            kahfPage: weekPagesRead,
            kahfTotal: KAHF_TOTAL_PAGES,
            durationSeconds: durationSec,
            weekPagesRead,
            weekTotalSeconds,
            isComplete: false,
            sessionPages,
          },
          t
        ),
        comparison
      )
    );
  }
}

// --- Shared page dispatch ---

async function dispatchPageResponse(
  ctx: CustomContext,
  state: TimerState,
  input: string,
  tz: string
): Promise<void> {
  const t = ctx.locale;

  switch (state.type) {
    case "normal_page": {
      const lastSession = await getLastSession(ctx.db, "normal");
      const pageStart = getNextPage(lastSession?.pageEnd ?? null);
      return handlePageResponse(
        ctx,
        state,
        input,
        "normal",
        pageStart,
        TOTAL_PAGES,
        () =>
          t.read.remainingPages(
            TOTAL_PAGES - pageStart + 1,
            pageStart,
            TOTAL_PAGES
          ),
        (_r, ps, pe, dur) =>
          formatReadConfirmation(
            {
              pageStart: ps,
              pageEnd: pe,
              durationSeconds: dur,
              totalPagesRead: pe,
              totalPages: TOTAL_PAGES,
            },
            t
          ),
        tz
      );
    }
    case "extra_page": {
      const parsedArgs = JSON.parse(state.args);
      return handlePageResponse(
        ctx,
        state,
        input,
        "extra",
        parsedArgs.page,
        TOTAL_PAGES,
        (pe) => t.timer.overflowPages(parsedArgs.page, pe, TOTAL_PAGES),
        (s) => formatSessionConfirmation({ ...s, type: "extra" }, t),
        tz
      );
    }
    case "kahf": {
      return handleKahfResponse(ctx, state, input, tz);
    }
    default:
      break;
  }
}

// --- Callbacks for page count inline buttons ---

export async function pagesCountCallback(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const match = ctx.callbackQuery?.data?.match(CALLBACK_PAGES_RE);
  if (!match) {
    return;
  }
  const count = Number(match[1]);

  const state = await getTimerState(ctx.db);
  if (!state?.awaitingResponse) {
    await ctx.editMessageText(t.timer.notFound);
    await ctx.answerCallbackQuery();
    return;
  }

  const question = getQuestionForType(
    state.type,
    state.durationSeconds ?? 0,
    t
  );
  await ctx.editMessageText(`${question}\n\n${count}`, {
    reply_markup: new InlineKeyboard(),
  });
  await ctx.answerCallbackQuery();

  const tz = await getTimezone(ctx.db);
  return dispatchPageResponse(ctx, state, String(count), tz);
}

export async function pagesOtherCallback(ctx: CustomContext): Promise<void> {
  const t = ctx.locale;
  const state = await getTimerState(ctx.db);
  if (!state?.awaitingResponse) {
    await ctx.editMessageText(t.timer.notFound);
    await ctx.answerCallbackQuery();
    return;
  }

  const question = getQuestionForType(
    state.type,
    state.durationSeconds ?? 0,
    t
  );
  await ctx.editMessageText(question, {
    reply_markup: new InlineKeyboard(),
  });
  await ctx.answerCallbackQuery();
}

// --- Middleware: timerResponseHandler ---

export async function timerResponseHandler(
  ctx: CustomContext,
  next: () => Promise<void>
): Promise<void> {
  const text = ctx.message?.text;
  if (!text || text.startsWith("/")) {
    return next();
  }

  const state = await getTimerState(ctx.db);
  if (!state?.awaitingResponse) {
    return next();
  }

  const t = ctx.locale;
  const trimmed = text.trim();

  try {
    const tz = await getTimezone(ctx.db);
    switch (state.type) {
      case "normal_page":
      case "extra_page":
      case "kahf":
        return dispatchPageResponse(ctx, state, trimmed, tz);

      case "normal_verse":
        return handleVerseResponse(ctx, state, trimmed, "normal", tz);

      case "extra_verse":
        return handleVerseResponse(ctx, state, trimmed, "extra", tz);

      default: {
        const _exhaustive: never = state.type;
        break;
      }
    }
  } catch (e) {
    console.error("timerResponseHandler error:", e);
    await ctx.reply(formatError(t.timer.internalError, t));
  }
}
