import { Bot, Context } from "grammy";
import { startHandler, helpHandler, configHandler } from "./handlers/config";
import { sessionHandler } from "./handlers/session";
import { importHandler } from "./handlers/import";
import { historyHandler, statsHandler, progressHandler, speedHandler } from "./handlers/stats";
import { readHandler } from "./handlers/read";
import { extraHandler } from "./handlers/extra";
import { kahfHandler } from "./handlers/kahf";
import {
  undoHandler,
  deleteHandler,
  confirmDeleteCallback,
  cancelDeleteCallback,
  CALLBACK_CONFIRM_RE,
  CALLBACK_CANCEL_RE,
} from "./handlers/manage";
import {
  goHandler,
  stopHandler,
  timerResponseHandler,
  confirmTimerStopCallback,
  cancelTimerStopCallback,
  stopTimerCallback,
  goTimerCallback,
  CALLBACK_TIMER_CONFIRM_RE,
  CALLBACK_TIMER_CANCEL_RE,
  CALLBACK_TIMER_STOP_RE,
  CALLBACK_TIMER_GO_RE,
} from "./handlers/timer";
import { debugHandler } from "./handlers/debug";
import { prayerHandler } from "./handlers/prayer";
import { resolveLocale } from "./services/localeCache";
import type { Locale } from "./locales";

export interface CustomContext extends Context {
  db: D1Database;
  locale: Locale;
}

export function createBot(token: string, db: D1Database, allowedUserId: string): Bot<CustomContext> {
  const bot = new Bot<CustomContext>(token);

  // Auth middleware — restrict to allowed user
  const parsedUserId = Number(allowedUserId);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    throw new Error("ALLOWED_USER_ID is not a valid integer");
  }
  bot.use((ctx, next) => {
    if (ctx.from?.id !== parsedUserId) return;
    return next();
  });

  // Middleware to inject db into context
  bot.use((ctx, next) => {
    ctx.db = db;
    return next();
  });

  // Middleware to inject locale into context (cached to avoid DB hit per message)
  bot.use(async (ctx, next) => {
    ctx.locale = await resolveLocale(db);
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
  bot.command("undo", undoHandler);
  bot.command("delete", deleteHandler);
  bot.command("config", configHandler);
  bot.command("prayer", prayerHandler);
  bot.command("debug", debugHandler);

  // Callbacks inline keyboard
  bot.callbackQuery(CALLBACK_TIMER_STOP_RE, stopTimerCallback);
  bot.callbackQuery(CALLBACK_TIMER_GO_RE, goTimerCallback);
  bot.callbackQuery(CALLBACK_TIMER_CONFIRM_RE, confirmTimerStopCallback);
  bot.callbackQuery(CALLBACK_TIMER_CANCEL_RE, cancelTimerStopCallback);
  bot.callbackQuery(CALLBACK_CONFIRM_RE, confirmDeleteCallback);
  bot.callbackQuery(CALLBACK_CANCEL_RE, cancelDeleteCallback);

  // Error handler global
  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}
