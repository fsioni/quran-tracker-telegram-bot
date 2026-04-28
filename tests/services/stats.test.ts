import { describe, expect, it, vi } from "vitest";
import { getPeriodStats } from "../../src/services/db/stats";

describe("getPeriodStats monthOffset", () => {
  it("uses an offset month when offset > 0", async () => {
    let boundStart = "";
    let boundEnd = "";
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn((start: string, end: string) => {
          boundStart = start;
          boundEnd = end;
          return {
            first: vi.fn(async () => ({
              sessions: 0,
              ayahs: 0,
              seconds: 0,
              pages: 0,
              page_seconds: 0,
            })),
          };
        }),
      })),
    } as unknown as D1Database;

    const tz = "America/Cancun";
    const result = await getPeriodStats(db, "month", tz, 2);
    expect(result.ok).toBe(true);
    expect(boundStart.endsWith("-01")).toBe(true);
    expect(boundEnd.length).toBe(10);
    expect(boundStart < boundEnd).toBe(true);

    // The offset=2 means 2 months back, so boundStart must be strictly
    // earlier than the current month's first day.
    const nowMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const boundMonth = boundStart.slice(0, 7); // "YYYY-MM"
    expect(boundMonth < nowMonth).toBe(true);
  });
});
