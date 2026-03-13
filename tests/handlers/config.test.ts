import { describe, it, expect, vi } from "vitest";
import { startHandler, helpHandler, WELCOME_MESSAGE } from "../../src/handlers/config";
import type { CustomContext } from "../../src/bot";

function createMockContext(chatId = 12345): CustomContext {
  const runFn = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
  const bindFn = vi.fn().mockReturnValue({ run: runFn, first: vi.fn(), all: vi.fn() });
  const prepareFn = vi.fn().mockReturnValue({ bind: bindFn, run: runFn, first: vi.fn(), all: vi.fn() });

  return {
    reply: vi.fn().mockResolvedValue(undefined),
    chat: { id: chatId },
    db: {
      prepare: prepareFn,
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn(),
    } as unknown as D1Database,
  } as unknown as CustomContext;
}

describe("startHandler", () => {
  it("replies with WELCOME_MESSAGE", async () => {
    const ctx = createMockContext();
    await startHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(WELCOME_MESSAGE);
  });

  it("calls db.prepare to persist chat_id via setConfig", async () => {
    const ctx = createMockContext(99999);
    await startHandler(ctx);
    expect(ctx.db.prepare).toHaveBeenCalled();
  });

  it("calls reply exactly once", async () => {
    const ctx = createMockContext();
    await startHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });
});

describe("helpHandler", () => {
  it("replies with WELCOME_MESSAGE", async () => {
    const ctx = createMockContext();
    await helpHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(WELCOME_MESSAGE);
  });

  it("does NOT call db.prepare", async () => {
    const ctx = createMockContext();
    await helpHandler(ctx);
    expect(ctx.db.prepare).not.toHaveBeenCalled();
  });

  it("calls reply exactly once", async () => {
    const ctx = createMockContext();
    await helpHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });
});
