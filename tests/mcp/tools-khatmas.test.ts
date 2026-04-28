import { describe, expect, it, vi } from "vitest";
import { getKhatmasTool } from "../../src/mcp/tools/khatmas";

describe("getKhatmasTool", () => {
  it("returns khatmas ordered by completed_at desc", async () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(async () => ({
          results: [
            { id: 2, completed_at: "2026-04-01" },
            { id: 1, completed_at: "2025-10-15" },
          ],
        })),
      })),
    } as unknown as D1Database;
    const r = await getKhatmasTool({ db });
    expect(r).toHaveLength(2);
    expect(r[0].id).toBe(2);
  });
});
