import { describe, expect, it } from "vitest";
import { validateSql } from "../../src/mcp/sql/validator";

describe("validateSql", () => {
  it("accepts a plain SELECT and injects LIMIT 500 when missing", () => {
    const r = validateSql("SELECT id FROM sessions");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.normalizedSql.toLowerCase()).toContain("limit 500");
      expect(r.value.injectedLimit).toBe(true);
    }
  });

  it("clamps an existing LIMIT > 1000 to 1000", () => {
    const r = validateSql("SELECT id FROM sessions LIMIT 5000");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.normalizedSql.toLowerCase()).toContain("limit 1000");
      expect(r.value.injectedLimit).toBe(true);
    }
  });

  it("keeps an existing LIMIT <= 1000 untouched", () => {
    const r = validateSql("SELECT id FROM sessions LIMIT 50");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.normalizedSql.toLowerCase()).toContain("limit 50");
      expect(r.value.injectedLimit).toBe(false);
    }
  });

  it.each([
    "INSERT INTO sessions (id) VALUES (1)",
    "UPDATE sessions SET ayah_count = 0",
    "DELETE FROM sessions",
    "DROP TABLE sessions",
    "CREATE TABLE x(a INT)",
    "ALTER TABLE sessions ADD COLUMN x INT",
    "PRAGMA table_info(sessions)",
    "ATTACH DATABASE 'x' AS y",
    "REPLACE INTO sessions VALUES (1)",
    "VACUUM",
  ])("rejects mutation: %s", (sql) => {
    const r = validateSql(sql);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SQL_NOT_SELECT");
    }
  });

  it("rejects multiple statements", () => {
    const r = validateSql("SELECT 1; SELECT 2");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SQL_NOT_SELECT");
    }
  });

  it.each([
    "SELECT * FROM sqlite_master",
    "SELECT * FROM sqlite_sequence",
    "SELECT * FROM sqlite_schema",
  ])("rejects forbidden table: %s", (sql) => {
    const r = validateSql(sql);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SQL_FORBIDDEN_TABLE");
    }
  });

  it("rejects unwhitelisted functions", () => {
    const r = validateSql("SELECT load_extension('x') FROM sessions");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SQL_FORBIDDEN_FUNCTION");
    }
  });

  it("accepts whitelisted aggregate", () => {
    const r = validateSql("SELECT COUNT(*) FROM sessions");
    expect(r.ok).toBe(true);
  });

  it("accepts whitelisted date function", () => {
    const r = validateSql("SELECT substr(started_at, 1, 10) FROM sessions");
    expect(r.ok).toBe(true);
  });
});
