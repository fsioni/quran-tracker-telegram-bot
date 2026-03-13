import { Bot, Context, webhookCallback } from "grammy";
import { startHandler, helpHandler } from "./handlers/config";

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

  return bot;
}
