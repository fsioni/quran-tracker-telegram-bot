import { describe, expect, it, vi } from "vitest";
import { executeSelect } from "../../src/mcp/sql/execute";

describe("executeSelect", () => {
  it("returns columns and rows", async () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(async () => ({
          results: [
            { a: 1, b: "x" },
            { a: 2, b: "y" },
          ],
        })),
      })),
    } as unknown as D1Database;
    const r = await executeSelect(db, "SELECT a, b FROM t LIMIT 500");
    expect(r.columns).toEqual(["a", "b"]);
    expect(r.rows).toEqual([
      [1, "x"],
      [2, "y"],
    ]);
    expect(r.rowCount).toBe(2);
  });

  it("returns empty result when no rows", async () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(async () => ({ results: [] })),
      })),
    } as unknown as D1Database;
    const r = await executeSelect(db, "SELECT a FROM t LIMIT 500");
    expect(r.columns).toEqual([]);
    expect(r.rows).toEqual([]);
    expect(r.rowCount).toBe(0);
  });

  it("rejects with SQL_TIMEOUT on long queries", async () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve({ results: [] }), 100);
            })
        ),
      })),
    } as unknown as D1Database;
    await expect(executeSelect(db, "SELECT 1", 10)).rejects.toMatchObject({
      code: "SQL_TIMEOUT",
    });
  });
});
