import { describe, expect, it, vi } from "vitest";
import { querySqlTool } from "../../src/mcp/tools/query-sql";

describe("querySqlTool", () => {
  it("executes a valid SELECT and reports truncated when LIMIT injected", async () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(async () => ({ results: [{ a: 1 }] })),
      })),
    } as unknown as D1Database;
    const r = await querySqlTool({
      db,
      params: { sql: "SELECT a FROM t" },
    });
    expect(r.rowCount).toBe(1);
    expect(r.truncated).toBe(true);
  });

  it("rejects mutations", async () => {
    const db = {} as unknown as D1Database;
    await expect(
      querySqlTool({ db, params: { sql: "DELETE FROM sessions" } })
    ).rejects.toMatchObject({ code: "SQL_NOT_SELECT" });
  });
});
