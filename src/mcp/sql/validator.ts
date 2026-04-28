import { Parser } from "node-sql-parser";
import { McpError } from "../errors";

const parser = new Parser();

const FUNCTION_WHITELIST = new Set([
  // Aggregates
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "total",
  "group_concat",
  // Date/time
  "date",
  "time",
  "datetime",
  "julianday",
  "strftime",
  "unixepoch",
  // String
  "substr",
  "substring",
  "length",
  "lower",
  "upper",
  "trim",
  "ltrim",
  "rtrim",
  "replace",
  "instr",
  "printf",
  "format",
  "concat",
  // Math / conditional / null
  "abs",
  "round",
  "ceil",
  "floor",
  "coalesce",
  "ifnull",
  "nullif",
  "cast",
  "iif",
]);

const FORBIDDEN_TABLES = new Set([
  "sqlite_master",
  "sqlite_sequence",
  "sqlite_schema",
  "sqlite_temp_master",
  "sqlite_temp_schema",
]);

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 500;

export interface ValidatedSql {
  injectedLimit: boolean;
  normalizedSql: string;
}

export type ValidateResult =
  | { ok: true; value: ValidatedSql }
  | { ok: false; error: McpError };

interface LimitClause {
  seperator: string;
  value: { type: string; value: number }[];
}

interface SelectStatement {
  type?: string;
  limit?: LimitClause;
  [key: string]: unknown;
}

export function validateSql(sql: string): ValidateResult {
  let ast: ReturnType<Parser["astify"]>;
  try {
    ast = parser.astify(sql, { database: "sqlite" });
  } catch (e) {
    return {
      ok: false,
      error: new McpError(
        "SQL_NOT_SELECT",
        `Could not parse SQL: ${e instanceof Error ? e.message : String(e)}`
      ),
    };
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1) {
    return {
      ok: false,
      error: new McpError(
        "SQL_NOT_SELECT",
        "Only a single SELECT statement is allowed."
      ),
    };
  }

  const stmt = statements[0] as unknown as SelectStatement;
  if (stmt.type !== "select") {
    return {
      ok: false,
      error: new McpError(
        "SQL_NOT_SELECT",
        `Only SELECT statements are allowed (got ${stmt.type}).`
      ),
    };
  }

  // Walk AST for forbidden tables and functions
  const forbidden = walkAst(stmt);
  if (forbidden) {
    return { ok: false, error: forbidden };
  }

  // Build normalized SQL with LIMIT injection/clamping
  let injectedLimit = false;
  if (!stmt.limit?.value || stmt.limit.value.length === 0) {
    stmt.limit = {
      seperator: "",
      value: [{ type: "number", value: DEFAULT_LIMIT }],
    };
    injectedLimit = true;
  } else {
    const last = stmt.limit.value.at(-1);
    if (last && typeof last.value === "number" && last.value > MAX_LIMIT) {
      last.value = MAX_LIMIT;
      injectedLimit = true;
    }
  }

  const normalizedSql = parser.sqlify(stmt as never, { database: "sqlite" });
  return { ok: true, value: { normalizedSql, injectedLimit } };
}

function getFunctionName(nameField: unknown): string | null {
  // aggr_func (e.g. COUNT): name is a plain string
  if (typeof nameField === "string") {
    return nameField.toLowerCase();
  }

  // regular function: name is { name: [{ type: "default", value: "substr" }] }
  if (
    nameField !== null &&
    typeof nameField === "object" &&
    Array.isArray((nameField as Record<string, unknown>).name)
  ) {
    const parts = (nameField as { name: { value: unknown }[] }).name;
    if (parts.length > 0 && typeof parts[0].value === "string") {
      return parts[0].value.toLowerCase();
    }
  }

  return null;
}

function checkForbiddenTable(obj: Record<string, unknown>): McpError | null {
  if (!Array.isArray(obj.from)) {
    return null;
  }
  for (const f of obj.from as Record<string, unknown>[]) {
    const tableName = typeof f.table === "string" ? f.table.toLowerCase() : "";
    if (FORBIDDEN_TABLES.has(tableName)) {
      return new McpError(
        "SQL_FORBIDDEN_TABLE",
        `Access to internal table '${tableName}' is not allowed.`
      );
    }
  }
  return null;
}

function checkForbiddenFunction(obj: Record<string, unknown>): McpError | null {
  if (obj.type !== "function" && obj.type !== "aggr_func") {
    return null;
  }
  const fnName = getFunctionName(obj.name);
  if (fnName !== null && !FUNCTION_WHITELIST.has(fnName)) {
    return new McpError(
      "SQL_FORBIDDEN_FUNCTION",
      `Function '${fnName}' is not allowed.`
    );
  }
  return null;
}

function walkAst(node: unknown): McpError | null {
  if (node === null || typeof node !== "object") {
    return null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const e = walkAst(item);
      if (e) {
        return e;
      }
    }
    return null;
  }

  const obj = node as Record<string, unknown>;

  const tableErr = checkForbiddenTable(obj);
  if (tableErr) {
    return tableErr;
  }

  const fnErr = checkForbiddenFunction(obj);
  if (fnErr) {
    return fnErr;
  }

  for (const key of Object.keys(obj)) {
    const e = walkAst(obj[key]);
    if (e) {
      return e;
    }
  }
  return null;
}
