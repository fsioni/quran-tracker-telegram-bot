import { describe, expect, it, vi } from "vitest";
import { getRecentSpeedTool } from "../../src/mcp/tools/speed";

describe("getRecentSpeedTool", () => {
  it("returns speed metrics from recent sessions", async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ total_seconds: 1400, total_pages: 7 })),
        })),
      })),
    } as unknown as D1Database;
    const r = await getRecentSpeedTool({
      db,
      tz: "America/Cancun",
      params: { days: 7 },
    });
    expect(r).not.toBeNull();
    if (r) {
      expect(r.secondsPerPage).toBe(200);
      expect(r.pagesPerDay).toBe(1);
    }
  });

  it("returns null when no pages in window", async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ total_seconds: 0, total_pages: 0 })),
        })),
      })),
    } as unknown as D1Database;
    const r = await getRecentSpeedTool({
      db,
      tz: "America/Cancun",
      params: { days: 7 },
    });
    expect(r).toBeNull();
  });
});
