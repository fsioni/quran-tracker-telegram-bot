// tests/handlers/stats.test.ts
import { describe, it, expect, vi } from "vitest";
import { historyHandler } from "../../src/handlers/stats";
import type { CustomContext } from "../../src/bot";

const MOCK_ROW = {
  id: 42,
  started_at: "2026-03-10 13:30:00",
  duration_seconds: 533,
  surah_start: 2,
  ayah_start: 77,
  surah_end: 2,
  ayah_end: 83,
  ayah_count: 7,
  created_at: "2026-03-10 13:30:00",
};

function createMockContext(rows: unknown[] = []): CustomContext {
  const allFn = vi.fn().mockResolvedValue({ results: rows });
  const bindFn = vi.fn().mockReturnValue({ run: vi.fn(), first: vi.fn(), all: allFn });
  const prepareFn = vi.fn().mockReturnValue({ bind: bindFn, run: vi.fn(), first: vi.fn(), all: allFn });

  return {
    reply: vi.fn().mockResolvedValue(undefined),
    chat: { id: 12345 },
    db: {
      prepare: prepareFn,
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn(),
    } as unknown as D1Database,
  } as unknown as CustomContext;
}

describe("historyHandler", () => {
  it("repond 'Aucune session' si historique vide", async () => {
    const ctx = createMockContext([]);
    await historyHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith("Aucune session enregistree.");
  });

  it("affiche une session formatee", async () => {
    const ctx = createMockContext([MOCK_ROW]);
    await historyHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("#42");
    expect(msg).toContain("10/03");
    expect(msg).toContain("Al-Baqara");
    expect(msg).toContain("8m53");
  });

  it("affiche plusieurs sessions separees par newline", async () => {
    const row2 = { ...MOCK_ROW, id: 41, ayah_start: 60, ayah_end: 76, ayah_count: 17 };
    const ctx = createMockContext([MOCK_ROW, row2]);
    await historyHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("#42");
    expect(msg).toContain("#41");
    expect(msg.split("\n")).toHaveLength(2);
  });

  it("appelle reply exactement une fois", async () => {
    const ctx = createMockContext([MOCK_ROW]);
    await historyHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });
});
