import { describe, expect, it, vi } from "vitest";
import {
  GetSessionsParams,
  getSessionsTool,
} from "../../src/mcp/tools/sessions";

describe("getSessionsTool", () => {
  it("returns sessions in a date range", async () => {
    const rows = [
      {
        id: 1,
        started_at: "2026-04-27 12:00:00",
        duration_seconds: 600,
        page_start: 1,
        page_end: 2,
        surah_start: 1,
        ayah_start: 1,
        surah_end: 2,
        ayah_end: 100,
        ayah_count: 200,
        type: "normal",
        created_at: "2026-04-27 12:01:00",
      },
    ];
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({ results: rows })),
        })),
      })),
    } as unknown as D1Database;
    const r = await getSessionsTool({
      db,
      params: GetSessionsParams.parse({ from: "2026-04-01", to: "2026-04-30" }),
    });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(1);
  });

  it("rejects invalid date format via schema", () => {
    const parsed = GetSessionsParams.safeParse({
      from: "not-a-date",
      to: "2026-04-30",
    });
    expect(parsed.success).toBe(false);
  });

  it("clamps limit to 200", () => {
    const parsed = GetSessionsParams.parse({
      from: "2026-04-01",
      to: "2026-04-30",
      limit: 999,
    });
    expect(parsed.limit).toBe(200);
  });
});
