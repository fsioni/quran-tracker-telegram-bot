import { describe, expect, it } from "vitest";
import { McpError, MCP_ERROR_CODES } from "../../src/mcp/errors";

describe("McpError", () => {
  it("carries code and message", () => {
    const err = new McpError(
      "SQL_NOT_SELECT",
      "Only SELECT statements are allowed"
    );
    expect(err.code).toBe("SQL_NOT_SELECT");
    expect(err.message).toBe("Only SELECT statements are allowed");
    expect(err).toBeInstanceOf(Error);
  });

  it("exposes the canonical code list", () => {
    expect(MCP_ERROR_CODES).toContain("INVALID_PARAMS");
    expect(MCP_ERROR_CODES).toContain("SQL_NOT_SELECT");
    expect(MCP_ERROR_CODES).toContain("SQL_FORBIDDEN_TABLE");
    expect(MCP_ERROR_CODES).toContain("SQL_FORBIDDEN_FUNCTION");
    expect(MCP_ERROR_CODES).toContain("SQL_TIMEOUT");
    expect(MCP_ERROR_CODES).toContain("DB_ERROR");
  });
});
