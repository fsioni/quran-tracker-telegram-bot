import { describe, expect, it, vi } from "vitest";
import { getConfigTool } from "../../src/mcp/tools/config";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

describe("getConfigTool", () => {
  it("returns city, country, timezone, and computed today", async () => {
    const valuesByKey: Record<string, string> = {
      city: "Playa del Carmen",
      country: "MX",
      timezone: "America/Cancun",
    };
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn((key: string) => ({
          first: vi.fn(async () => ({ value: valuesByKey[key] })),
        })),
      })),
    } as unknown as D1Database;
    const r = await getConfigTool({ db });
    expect(r.city).toBe("Playa del Carmen");
    expect(r.country).toBe("MX");
    expect(r.timezone).toBe("America/Cancun");
    expect(r.today).toMatch(ISO_DATE_REGEX);
  });
});
