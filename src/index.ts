import { createBot } from "./bot";
import { webhookCallback } from "grammy";

export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const bot = createBot(env.BOT_TOKEN, env.DB);
    return webhookCallback(bot, "cloudflare-mod")(request);
  },

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    // TODO: prayer reminder cron logic
  },
};
