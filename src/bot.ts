import { Bot, type Context } from "grammy";
import {
  configHandler,
  helpHandler,
  langSetCallback,
  startHandler,
} from "./handlers/config";
import { debugHandler } from "./handlers/debug";
import { editHandler } from "./handlers/edit";
import { extraHandler } from "./handlers/extra";
import { graphHandler } from "./handlers/graph";
import { importHandler } from "./handlers/import";
import { kahfHandler } from "./handlers/kahf";
import {
  CALLBACK_CANCEL_RE,
  CALLBACK_CONFIRM_RE,
  cancelDeleteCallback,
  confirmDeleteCallback,
  deleteHandler,
  undoHandler,
} from "./handlers/manage";
import { prayerHandler } from "./handlers/prayer";
import { readHandler } from "./handlers/read";
import { sessionHandler } from "./handlers/session";
import {
  CALLBACK_HISTORY_RE,
  historyHandler,
  historyPageCallback,
  progressHandler,
  speedHandler,
  statsHandler,
} from "./handlers/stats";
import {
  CALLBACK_PAGES_OTHER_RE,
  CALLBACK_PAGES_RE,
  CALLBACK_TIMER_CANCEL_RE,
  CALLBACK_TIMER_CONFIRM_RE,
  CALLBACK_TIMER_GO_RE,
  CALLBACK_TIMER_STOP_RE,
  cancelTimerStopCallback,
  confirmTimerStopCallback,
  goHandler,
  goTimerCallback,
  pagesCountCallback,
  pagesOtherCallback,
  stopHandler,
  stopTimerCallback,
  timerResponseHandler,
} from "./handlers/timer";
import { CALLBACK_LANG_SET_RE } from "./locales";
import type { Locale } from "./locales/types";
import { resolveLocale } from "./services/locale-cache";

export interface CustomContext extends Context {
  db: D1Database;
  locale: Locale;
}

export function createBot(
  token: string,
  db: D1Database,
  allowedUserId: string
): Bot<CustomContext> {
  const bot = new Bot<CustomContext>(token);

  // Auth middleware — restrict to allowed user
  const parsedUserId = Number(allowedUserId);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    throw new Error("ALLOWED_USER_ID is not a valid integer");
  }
  bot.use((ctx, next) => {
    if (ctx.from?.id !== parsedUserId) {
      return;
    }
    return next();
  });

  // Middleware to inject db into context
  bot.use((ctx, next) => {
    ctx.db = db;
    return next();
  });

  // Middleware to inject locale into context (cached to avoid DB hit per message)
  bot.use(async (ctx, next) => {
    ctx.locale = await resolveLocale(db, ctx.from?.language_code ?? null);
    return next();
  });

  // Timer middleware (must be before commands)
  bot.use(timerResponseHandler);

  // Register command handlers
  bot.command("go", goHandler);
  bot.command("stop", stopHandler);
  bot.command("start", startHandler);
  bot.command("help", helpHandler);
  bot.command("session", sessionHandler);
  bot.command("read", readHandler);
  bot.command("extra", extraHandler);
  bot.command("kahf", kahfHandler);
  bot.command("import", importHandler);
  bot.command("history", historyHandler);
  bot.command("stats", statsHandler);
  bot.command("progress", progressHandler);
  bot.command("speed", speedHandler);
  bot.command("graph", graphHandler);
  bot.command("undo", undoHandler);
  bot.command("delete", deleteHandler);
  bot.command("edit", editHandler);
  bot.command("config", configHandler);
  bot.command("prayer", prayerHandler);
  bot.command("debug", debugHandler);

  // Callbacks inline keyboard
  bot.callbackQuery(CALLBACK_TIMER_STOP_RE, stopTimerCallback);
  bot.callbackQuery(CALLBACK_TIMER_GO_RE, goTimerCallback);
  bot.callbackQuery(CALLBACK_TIMER_CONFIRM_RE, confirmTimerStopCallback);
  bot.callbackQuery(CALLBACK_TIMER_CANCEL_RE, cancelTimerStopCallback);
  bot.callbackQuery(CALLBACK_PAGES_RE, pagesCountCallback);
  bot.callbackQuery(CALLBACK_PAGES_OTHER_RE, pagesOtherCallback);
  bot.callbackQuery(CALLBACK_CONFIRM_RE, confirmDeleteCallback);
  bot.callbackQuery(CALLBACK_CANCEL_RE, cancelDeleteCallback);
  bot.callbackQuery(CALLBACK_LANG_SET_RE, langSetCallback);
  bot.callbackQuery(CALLBACK_HISTORY_RE, historyPageCallback);

  // Error handler global
  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}
