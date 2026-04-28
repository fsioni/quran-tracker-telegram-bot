import { describe, expect, it } from "vitest";
import {
  getJuzPagesTool,
  getSchemaTool,
  getSurahsTool,
} from "../../src/mcp/tools/reference";

describe("getSurahsTool", () => {
  it("returns all 114 surahs by default", async () => {
    const r = await getSurahsTool({ params: {} });
    expect(r).toHaveLength(114);
    expect(r[0].id).toBe(1);
  });

  it("filters by ids", async () => {
    const r = await getSurahsTool({ params: { ids: [1, 2, 18] } });
    expect(r).toHaveLength(3);
    expect(r.map((s) => s.id).sort((a, b) => a - b)).toEqual([1, 2, 18]);
  });
});

describe("getJuzPagesTool", () => {
  it("returns all 30 juz by default", async () => {
    const r = await getJuzPagesTool({ params: {} });
    expect(r).toHaveLength(30);
  });

  it("filters by single juz", async () => {
    const r = await getJuzPagesTool({ params: { juz: 1 } });
    expect(r).toHaveLength(1);
    expect(r[0].juz).toBe(1);
  });
});

describe("getSchemaTool", () => {
  it("returns the full schema markdown", async () => {
    const r = await getSchemaTool({ params: {} });
    expect(r).toContain("## sessions");
    expect(r).toContain("## khatmas");
  });
});
