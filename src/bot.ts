import { Bot, Context } from "grammy";
import { startHandler, helpHandler } from "./handlers/config";
import { sessionHandler } from "./handlers/session";
import { importHandler } from "./handlers/import";
import { historyHandler, statsHandler, progressHandler } from "./handlers/stats";
import {
  undoHandler,
  deleteHandler,
  confirmDeleteCallback,
  cancelDeleteCallback,
  CALLBACK_CONFIRM_RE,
  CALLBACK_CANCEL_RE,
} from "./handlers/manage";

export interface CustomContext extends Context {
  db: D1Database;
}

export function createBot(token: string, db: D1Database): Bot<CustomContext> {
  const bot = new Bot<CustomContext>(token);

  // Middleware to inject db into context
  bot.use((ctx, next) => {
    ctx.db = db;
    return next();
  });

  // Register command handlers
  bot.command("start", startHandler);
  bot.command("help", helpHandler);
  bot.command("session", sessionHandler);
  bot.command("import", importHandler);
  bot.command("history", historyHandler);
  bot.command("stats", statsHandler);
  bot.command("progress", progressHandler);
  bot.command("undo", undoHandler);
  bot.command("delete", deleteHandler);

  // Callbacks inline keyboard
  bot.callbackQuery(CALLBACK_CONFIRM_RE, confirmDeleteCallback);
  bot.callbackQuery(CALLBACK_CANCEL_RE, cancelDeleteCallback);

  // Error handler global
  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}
