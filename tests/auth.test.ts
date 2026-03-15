import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBot } from "../src/bot";
import type { Bot } from "grammy";
import type { CustomContext } from "../src/bot";
import type { Update } from "grammy/types";

const ALLOWED_ID = 123456;
const STRANGER_ID = 999999;

function makeUpdate(userId: number): Update {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: userId, type: "private" },
      from: { id: userId, is_bot: false, first_name: "Test" },
      text: "hello",
    },
  };
}

function setupBot(): { bot: Bot<CustomContext>; handlerCalled: ReturnType<typeof vi.fn> } {
  const bot = createBot("fake-token", {} as D1Database, String(ALLOWED_ID));
  bot.api.config.use(() => ({ ok: true, result: true }) as never);
  const handlerCalled = vi.fn();
  bot.on("message:text", handlerCalled);
  return { bot, handlerCalled };
}

describe("auth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allowed user reaches handlers", async () => {
    const { bot, handlerCalled } = setupBot();
    await bot.init();
    await bot.handleUpdate(makeUpdate(ALLOWED_ID));
    expect(handlerCalled).toHaveBeenCalled();
  });

  it("unauthorized user is silently ignored", async () => {
    const { bot, handlerCalled } = setupBot();
    await bot.init();
    await bot.handleUpdate(makeUpdate(STRANGER_ID));
    expect(handlerCalled).not.toHaveBeenCalled();
  });

  it("rejects invalid ALLOWED_USER_ID", () => {
    expect(() => createBot("fake-token", {} as D1Database, "not-a-number")).toThrow(
      "ALLOWED_USER_ID is not a valid integer",
    );
  });
});
