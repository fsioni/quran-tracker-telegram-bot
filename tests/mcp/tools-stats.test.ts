import { describe, expect, it, vi } from "vitest";
import {
  GetPeriodStatsParams,
  getGlobalStatsTool,
  getPeriodStatsTool,
  getStreakTool,
} from "../../src/mcp/tools/stats";

function mockDb(row: Record<string, unknown>) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => row),
      })),
      first: vi.fn(async () => row),
      all: vi.fn(async () => ({ results: [] })),
    })),
  } as unknown as D1Database;
}

describe("getGlobalStatsTool", () => {
  it("returns global stats with no type filter", async () => {
    const db = mockDb({
      total_sessions: 42,
      total_ayahs: 1000,
      total_seconds: 7200,
      avg_ayahs: 23,
      avg_seconds: 171,
      total_pages: 50,
      total_page_seconds: 7000,
    });
    const r = await getGlobalStatsTool({ db, params: {} });
    expect(r.totalSessions).toBe(42);
    expect(r.totalAyahs).toBe(1000);
  });

  it("passes type filter", async () => {
    const db = mockDb({
      total_sessions: 5,
      total_ayahs: 100,
      total_seconds: 600,
      avg_ayahs: 20,
      avg_seconds: 120,
      total_pages: 4,
      total_page_seconds: 600,
    });
    const r = await getGlobalStatsTool({ db, params: { type: "kahf" } });
    expect(r.totalSessions).toBe(5);
  });
});

describe("getPeriodStatsTool", () => {
  it("returns week stats", async () => {
    const db = mockDb({
      sessions: 3,
      ayahs: 50,
      seconds: 1800,
      pages: 5,
      page_seconds: 1800,
    });
    const r = await getPeriodStatsTool({
      db,
      tz: "America/Cancun",
      params: GetPeriodStatsParams.parse({ period: "week" }),
    });
    expect(r.sessions).toBe(3);
  });
});

describe("getStreakTool", () => {
  it("returns current and best streak", async () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(async () => ({
          results: [{ day: "2026-04-28" }, { day: "2026-04-27" }],
        })),
      })),
    } as unknown as D1Database;
    const r = await getStreakTool({ db, tz: "America/Cancun" });
    expect(r.currentStreak).toBeGreaterThanOrEqual(0);
    expect(r.bestStreak).toBeGreaterThanOrEqual(0);
  });
});
