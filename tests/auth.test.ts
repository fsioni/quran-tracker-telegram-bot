import type { Bot } from "grammy";
import type { Update } from "grammy/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomContext } from "../src/bot";
import { createBot } from "../src/bot";

const ALLOWED_ID = 123_456;
const STRANGER_ID = 999_999;

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

function makeMockDb(): D1Database {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => null,
        run: async () => ({ success: true }),
      }),
      first: async () => null,
      run: async () => ({ success: true }),
    }),
  } as unknown as D1Database;
}

function setupBot(): {
  bot: Bot<CustomContext>;
  handlerCalled: ReturnType<typeof vi.fn>;
} {
  const bot = createBot("fake-token", makeMockDb(), String(ALLOWED_ID));
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
    expect(() =>
      createBot("fake-token", {} as D1Database, "not-a-number")
    ).toThrow("ALLOWED_USER_ID is not a valid integer");
  });

  it("rejects empty ALLOWED_USER_ID", () => {
    expect(() => createBot("fake-token", {} as D1Database, "")).toThrow(
      "ALLOWED_USER_ID is not a valid integer"
    );
  });
});
