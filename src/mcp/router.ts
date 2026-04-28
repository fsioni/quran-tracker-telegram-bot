import { Bot, webhookCallback } from "grammy";
import { createBot } from "../bot";
import { getBotCommands, getLocale } from "../locales";
import { getConfig } from "../services/db/config";
import {
  handleAuthorize,
  handleLoginRequest,
  handleLoginVerify,
  type OAuthHelpers,
} from "./auth/handlers";

interface Env {
  ALLOWED_USER_ID: string;
  BOT_TOKEN: string;
  DB: D1Database;
  MCP_SESSION_HMAC_SECRET: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
}

export const mcpDefaultHandler: ExportedHandler<Env> = {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/oauth/authorize" && request.method === "GET") {
      return handleAuthorize(request, env);
    }
    if (url.pathname === "/oauth/login/request" && request.method === "POST") {
      return handleLoginRequest(request, env);
    }
    if (url.pathname === "/oauth/login/verify" && request.method === "POST") {
      return handleLoginVerify(request, env);
    }

    if (url.pathname === "/setup") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      if (request.headers.get("Authorization") !== `Bearer ${env.BOT_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const bot = new Bot(env.BOT_TOKEN);
        const lang = await getConfig(env.DB, "language");
        const t = getLocale(lang);
        await bot.api.setMyCommands(getBotCommands(t));
        return new Response("Commands registered");
      } catch (e) {
        console.error(
          "setMyCommands failed:",
          e instanceof Error ? e.message : String(e)
        );
        return new Response("Failed to register commands", { status: 502 });
      }
    }

    // Default: Telegram webhook
    const bot = createBot(env.BOT_TOKEN, env.DB, env.ALLOWED_USER_ID);
    return webhookCallback(bot, "cloudflare-mod")(request);
  },
};
