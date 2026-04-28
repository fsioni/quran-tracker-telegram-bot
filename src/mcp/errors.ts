export const MCP_ERROR_CODES = [
  "INVALID_PARAMS",
  "SQL_NOT_SELECT",
  "SQL_FORBIDDEN_TABLE",
  "SQL_FORBIDDEN_FUNCTION",
  "SQL_TIMEOUT",
  "DB_ERROR",
] as const;

export type McpErrorCode = (typeof MCP_ERROR_CODES)[number];

export class McpError extends Error {
  constructor(
    public readonly code: McpErrorCode,
    message: string
  ) {
    super(message);
    this.name = "McpError";
  }
}
