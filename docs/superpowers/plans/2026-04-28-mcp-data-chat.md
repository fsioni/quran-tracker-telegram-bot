# MCP Data Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a remote, read-only MCP server on the existing Cloudflare Worker that lets the user chat with their Quran reading data from the Claude app (web + mobile).

**Architecture:** A new `src/mcp/` module sits alongside existing `src/handlers/` and `src/services/`. The root fetch handler dispatches `/mcp/*` and `/oauth/*` to the MCP layer; everything else continues to the existing Telegram webhook. Tools are thin wrappers over `src/services/db/*`. A single `query_sql` escape-hatch tool runs SELECT-only statements validated through an AST parser. Authentication is OAuth 2.1 with a magic-link login: the user clicks a button on the worker's login page and receives a 6-digit code via the existing Telegram bot.

**Tech Stack:** TypeScript, Cloudflare Workers, D1 (SQLite), KV, grammY (existing), `@modelcontextprotocol/sdk`, `@cloudflare/workers-oauth-provider`, `node-sql-parser`, `zod`, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-28-mcp-data-chat-design.md`

---

## File Structure

New files (created in this plan):

```
src/mcp/
  server.ts            # MCP server + SSE transport, tool/resource registration
  index.ts             # MCP/OAuth router, exported as `handleMcpRequest`
  errors.ts            # McpError class + error codes
  tools/
    index.ts           # Re-exports + registry helper
    stats.ts           # get_global_stats, get_period_stats, get_streak
    sessions.ts        # get_sessions
    khatmas.ts         # get_khatmas
    speed.ts           # get_recent_speed
    config.ts          # get_config
    reference.ts       # get_surahs, get_juz_pages, get_schema
    query-sql.ts       # query_sql (validator + execute)
  resources/
    schema.md          # generated schema doc (committed for audit)
    schema-text.ts     # generated TS module exporting schema.md as a string
  sql/
    validator.ts       # AST validation, LIMIT injection, function whitelist
    execute.ts         # D1 wrapper with timeout
  auth/
    provider.ts        # OAuthProvider configuration
    session.ts         # HMAC signing, code hashing, KV ops, rate limit
    telegram-code.ts   # Send 6-digit code via the Telegram bot
    pages.ts           # HTML templates for login pages 1 and 2
    handlers.ts        # GET /oauth/authorize, POST /oauth/login/{request,verify}
scripts/
  gen-schema.ts        # Regenerate src/mcp/resources/schema.md from schema.sql
tests/
  mcp/
    sql-validator.test.ts
    sql-execute.test.ts
    tools-stats.test.ts
    tools-sessions.test.ts
    tools-khatmas.test.ts
    tools-speed.test.ts
    tools-config.test.ts
    tools-reference.test.ts
    tools-query-sql.test.ts
    auth-session.test.ts
    auth-pages.test.ts
    auth-handlers.test.ts
    schema-snapshot.test.ts
```

Files modified:
- `src/index.ts` (router)
- `src/locales/types.ts`, `src/locales/en.ts`, `src/locales/fr.ts`, `src/locales/ar.ts` (locale keys)
- `src/services/db/stats.ts` (extend `getPeriodStats` with `monthOffset`)
- `wrangler.toml` (KV namespace)
- `package.json` (deps + script)
- `tsconfig.json` (only if `node-sql-parser` requires types adjustment)

---

## Task 1: Add dependencies, KV namespace, and Env type

**Files:**
- Modify: `package.json`
- Modify: `wrangler.toml`
- Modify: `src/index.ts:46-50` (Env interface)

- [ ] **Step 1: Install runtime deps**

```bash
pnpm add @modelcontextprotocol/sdk @cloudflare/workers-oauth-provider node-sql-parser zod
```

Expected: dependencies added under `"dependencies"` in `package.json`.

- [ ] **Step 2: Provision the KV namespace locally**

Run:
```bash
pnpm exec wrangler kv namespace create OAUTH_KV
```
Expected output contains a line like:
```
{ binding = "OAUTH_KV", id = "abcdef..." }
```
Copy that `id`.

- [ ] **Step 3: Add KV binding in `wrangler.toml`**

Append after the existing `[[d1_databases]]` block:

```toml
[[kv_namespaces]]
binding = "OAUTH_KV"
id = "<paste id from step 2>"
```

- [ ] **Step 4: Extend the Env interface**

Edit `src/index.ts:46-50`:

```ts
export interface Env {
  ALLOWED_USER_ID: string;
  BOT_TOKEN: string;
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  MCP_SESSION_HMAC_SECRET: string;
}
```

- [ ] **Step 5: Set the HMAC secret locally**

```bash
pnpm exec wrangler secret put MCP_SESSION_HMAC_SECRET
```
At the prompt, paste 32 random bytes, e.g. produced by:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- [ ] **Step 6: Verify type-check passes**

Run: `pnpm type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml wrangler.toml src/index.ts
git commit -m "Add MCP dependencies, KV namespace, and HMAC secret binding"
```

---

## Task 2: Extend `getPeriodStats` to support `monthOffset`

**Files:**
- Modify: `src/services/db/stats.ts:73-117`
- Test: `tests/services/stats.test.ts` (modify if exists, else create)

The existing function only honors `weekOffset`. The MCP `get_period_stats` tool exposes a generic `offset?: int`. Extend the function so `offset` applies to months too.

- [ ] **Step 1: Write the failing test**

Append to `tests/services/stats.test.ts` (create the file if absent):

```ts
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
    // Simulate "2 months ago" relative to a fixed date by overriding Date
    const result = await getPeriodStats(db, "month", tz, 2);
    expect(result.ok).toBe(true);
    // boundStart should be a YYYY-MM-01 from two months earlier than today.
    expect(boundStart.endsWith("-01")).toBe(true);
    expect(boundEnd.length).toBe(10);
    // End < start of "today's" month
    expect(boundStart < boundEnd).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/services/stats.test.ts
```
Expected: FAIL — current code ignores `offset` for `month`.

- [ ] **Step 3: Modify `getPeriodStats`**

In `src/services/db/stats.ts`, replace the function signature and the bounds computation:

```ts
export async function getPeriodStats(
  db: D1Database,
  period: "week" | "month",
  tz: string,
  offset = 0
): Promise<Result<PeriodStats>> {
  const today = getTodayInTimezone(tz);
  let bounds: { start: string; end: string };
  if (period === "week") {
    const baseDay = offset > 0 ? addDays(today, -7 * offset) : today;
    bounds = getWeekBounds(baseDay);
  } else {
    bounds = getMonthBounds(today, offset);
  }
  // ...rest unchanged
}
```

- [ ] **Step 4: Update `getMonthBounds` to accept an offset**

Open `src/services/db/date-helpers.ts`, find `getMonthBounds`, and change the signature:

```ts
export function getMonthBounds(
  today: string,
  monthsBack = 0
): { start: string; end: string } {
  const [yStr, mStr] = today.split("-");
  const targetYear = Number(yStr);
  const targetMonth0 = Number(mStr) - 1 - monthsBack; // 0-based
  const date = new Date(Date.UTC(targetYear, targetMonth0, 1));
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}
```

If existing callers pass only `today`, they keep working (default 0).

- [ ] **Step 5: Run the test, verify it passes**

```bash
pnpm test tests/services/stats.test.ts
```
Expected: PASS.

- [ ] **Step 6: Run the full test suite**

```bash
pnpm test
```
Expected: all tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/services/db/stats.ts src/services/db/date-helpers.ts tests/services/stats.test.ts
git commit -m "Extend getPeriodStats with offset for month period"
```

---

## Task 3: Add locale meta `dir` and `mcpLogin` / `mcpTelegramCode` keys

**Files:**
- Modify: `src/locales/types.ts`
- Modify: `src/locales/en.ts`, `src/locales/fr.ts`, `src/locales/ar.ts`
- Test: existing locale exhaustiveness tests will catch missing keys

- [ ] **Step 1: Add to `Locale` type**

In `src/locales/types.ts`, after the existing `lang` field (line 156), add `dir`:

```ts
  // Text direction for rendering HTML
  dir: "ltr" | "rtl";
```

At the bottom of the interface (before the closing `}`), add:

```ts
  // MCP login page
  mcpLogin: {
    pageTitle: string;
    heading: string;
    intro: string;
    sendCodeButton: string;
    codeInputLabel: string;
    verifyButton: string;
    codeSentNotice: string;
    errorWrongCode: (remaining: number) => string;
    errorExpired: string;
    errorRateLimited: (minutes: number) => string;
    errorTelegramSend: string;
  };

  // MCP Telegram code message
  mcpTelegramCode: (code: string) => string;
```

- [ ] **Step 2: Implement in `src/locales/en.ts`**

Add to the exported `en` object:

```ts
  dir: "ltr",
  mcpLogin: {
    pageTitle: "Quran Tracker — Connect",
    heading: "Connect Claude to your reading data",
    intro: "Click the button to receive a 6-digit code via Telegram.",
    sendCodeButton: "Send code",
    codeInputLabel: "Enter the 6-digit code",
    verifyButton: "Verify",
    codeSentNotice: "Code sent to your Telegram. It is valid for 5 minutes.",
    errorWrongCode: (remaining) =>
      `Wrong code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`,
    errorExpired: "Code expired. Please restart the login.",
    errorRateLimited: (minutes) =>
      `Too many attempts. Try again in ${minutes} min.`,
    errorTelegramSend: "Failed to send the Telegram code. Please try again.",
  },
  mcpTelegramCode: (code) =>
    `MCP login code: ${code} (valid 5 min). Ignore if you didn't request it.`,
```

- [ ] **Step 3: Implement in `src/locales/fr.ts`**

```ts
  dir: "ltr",
  mcpLogin: {
    pageTitle: "Quran Tracker — Connexion",
    heading: "Connecter Claude à tes données de lecture",
    intro: "Clique pour recevoir un code à 6 chiffres via Telegram.",
    sendCodeButton: "Envoyer le code",
    codeInputLabel: "Entre le code à 6 chiffres",
    verifyButton: "Vérifier",
    codeSentNotice: "Code envoyé sur Telegram. Valable 5 minutes.",
    errorWrongCode: (remaining) =>
      `Code incorrect. Encore ${remaining} essai${remaining === 1 ? "" : "s"}.`,
    errorExpired: "Code expiré. Recommence la connexion.",
    errorRateLimited: (minutes) =>
      `Trop de tentatives. Réessaie dans ${minutes} min.`,
    errorTelegramSend: "Échec de l'envoi du code Telegram. Réessaie.",
  },
  mcpTelegramCode: (code) =>
    `Code MCP : ${code} (valable 5 min). Ignore si tu n'as rien demandé.`,
```

- [ ] **Step 4: Implement in `src/locales/ar.ts`**

```ts
  dir: "rtl",
  mcpLogin: {
    pageTitle: "Quran Tracker — الاتصال",
    heading: "ربط Claude ببيانات القراءة",
    intro: "اضغط لاستلام رمز من 6 أرقام عبر تيليجرام.",
    sendCodeButton: "إرسال الرمز",
    codeInputLabel: "أدخل الرمز المكوّن من 6 أرقام",
    verifyButton: "تحقّق",
    codeSentNotice: "تم إرسال الرمز إلى تيليجرام. صالح لمدة 5 دقائق.",
    errorWrongCode: (remaining) => `رمز خاطئ. تبقّت ${remaining} محاولة.`,
    errorExpired: "انتهت صلاحية الرمز. أعد الاتصال.",
    errorRateLimited: (minutes) => `محاولات كثيرة. أعد المحاولة بعد ${minutes} دقيقة.`,
    errorTelegramSend: "تعذّر إرسال الرمز عبر تيليجرام. أعد المحاولة.",
  },
  mcpTelegramCode: (code) =>
    `رمز الدخول MCP: ${code} (صالح 5 دقائق). تجاهل إن لم تطلبه.`,
```

- [ ] **Step 5: Run the existing locale exhaustiveness tests**

```bash
pnpm test
```
Expected: PASS (locale tests confirm all three locales implement every key).

- [ ] **Step 6: Commit**

```bash
git add src/locales/types.ts src/locales/en.ts src/locales/fr.ts src/locales/ar.ts
git commit -m "Add dir meta and mcpLogin/mcpTelegramCode locale keys"
```

---

## Task 4: Define `McpError` and error codes

**Files:**
- Create: `src/mcp/errors.ts`
- Test: `tests/mcp/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/mcp/errors.test.ts
import { describe, expect, it } from "vitest";
import { McpError, MCP_ERROR_CODES } from "../../src/mcp/errors";

describe("McpError", () => {
  it("carries code and message", () => {
    const err = new McpError("SQL_NOT_SELECT", "Only SELECT statements are allowed");
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
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/mcp/errors.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/mcp/errors.ts`**

```ts
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
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
pnpm test tests/mcp/errors.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/errors.ts tests/mcp/errors.test.ts
git commit -m "Add McpError class and canonical error codes"
```

---

## Task 5: SQL validator (AST-based)

**Files:**
- Create: `src/mcp/sql/validator.ts`
- Test: `tests/mcp/sql-validator.test.ts`

The validator parses SQL via `node-sql-parser` (SQLite dialect), enforces SELECT-only, rejects `sqlite_*` tables and disallowed functions, and injects/clamps `LIMIT`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/mcp/sql-validator.test.ts
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
    if (!r.ok) expect(r.error.code).toBe("SQL_NOT_SELECT");
  });

  it("rejects multiple statements", () => {
    const r = validateSql("SELECT 1; SELECT 2");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SQL_NOT_SELECT");
  });

  it.each([
    "SELECT * FROM sqlite_master",
    "SELECT * FROM sqlite_sequence",
    "SELECT * FROM sqlite_schema",
  ])("rejects forbidden table: %s", (sql) => {
    const r = validateSql(sql);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SQL_FORBIDDEN_TABLE");
  });

  it("rejects unwhitelisted functions", () => {
    const r = validateSql("SELECT load_extension('x') FROM sessions");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SQL_FORBIDDEN_FUNCTION");
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
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/mcp/sql-validator.test.ts
```
Expected: FAIL — validator not implemented.

- [ ] **Step 3: Implement `src/mcp/sql/validator.ts`**

```ts
import { Parser } from "node-sql-parser";
import { McpError } from "../errors";

const parser = new Parser();

const FUNCTION_WHITELIST = new Set([
  // Aggregates
  "count", "sum", "avg", "min", "max", "total", "group_concat",
  // Date/time
  "date", "time", "datetime", "julianday", "strftime", "unixepoch",
  // String
  "substr", "substring", "length", "lower", "upper", "trim", "ltrim", "rtrim",
  "replace", "instr", "printf", "format", "concat",
  // Math
  "abs", "round", "ceil", "floor", "min", "max", "coalesce", "ifnull",
  "nullif", "cast",
  // Conditional
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
  normalizedSql: string;
  injectedLimit: boolean;
}

export type ValidateResult =
  | { ok: true; value: ValidatedSql }
  | { ok: false; error: McpError };

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
  const stmt = statements[0] as { type?: string };
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
  const forbidden = walkAst(stmt as Record<string, unknown>);
  if (forbidden) return { ok: false, error: forbidden };

  // Build normalized SQL with LIMIT injection/clamping
  const select = stmt as {
    limit?: { seperator: string; value: { type: string; value: number }[] };
  };
  let injectedLimit = false;
  if (!select.limit || !select.limit.value || select.limit.value.length === 0) {
    select.limit = {
      seperator: "",
      value: [{ type: "number", value: DEFAULT_LIMIT }],
    };
    injectedLimit = true;
  } else {
    const last = select.limit.value[select.limit.value.length - 1];
    if (typeof last.value === "number" && last.value > MAX_LIMIT) {
      last.value = MAX_LIMIT;
      injectedLimit = true;
    }
  }

  const normalizedSql = parser.sqlify(stmt as never, { database: "sqlite" });
  return { ok: true, value: { normalizedSql, injectedLimit } };
}

function walkAst(
  node: unknown,
  inFromClause = false
): McpError | null {
  if (node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const e = walkAst(item, inFromClause);
      if (e) return e;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;

  // Reject `from` referencing forbidden tables
  if (Array.isArray(obj.from)) {
    for (const f of obj.from as Array<Record<string, unknown>>) {
      const tableName = typeof f.table === "string" ? f.table.toLowerCase() : "";
      if (FORBIDDEN_TABLES.has(tableName)) {
        return new McpError(
          "SQL_FORBIDDEN_TABLE",
          `Access to internal table '${tableName}' is not allowed.`
        );
      }
    }
  }

  // Reject function calls outside the whitelist
  if (
    (obj.type === "function" || obj.type === "aggr_func") &&
    typeof obj.name === "string"
  ) {
    const fnName = obj.name.toLowerCase();
    if (!FUNCTION_WHITELIST.has(fnName)) {
      return new McpError(
        "SQL_FORBIDDEN_FUNCTION",
        `Function '${fnName}' is not allowed.`
      );
    }
  }

  for (const key of Object.keys(obj)) {
    const e = walkAst(obj[key], inFromClause || key === "from");
    if (e) return e;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/mcp/sql-validator.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/sql/validator.ts tests/mcp/sql-validator.test.ts
git commit -m "Add SQL validator with AST-based SELECT-only enforcement"
```

---

## Task 6: SQL execute wrapper with timeout

**Files:**
- Create: `src/mcp/sql/execute.ts`
- Test: `tests/mcp/sql-execute.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/mcp/sql-execute.test.ts
import { describe, expect, it, vi } from "vitest";
import { executeSelect } from "../../src/mcp/sql/execute";

describe("executeSelect", () => {
  it("returns columns and rows", async () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(async () => ({
          results: [{ a: 1, b: "x" }, { a: 2, b: "y" }],
        })),
      })),
    } as unknown as D1Database;
    const r = await executeSelect(db, "SELECT a, b FROM t LIMIT 500");
    expect(r.columns).toEqual(["a", "b"]);
    expect(r.rows).toEqual([[1, "x"], [2, "y"]]);
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
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/mcp/sql-execute.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/mcp/sql/execute.ts`**

```ts
import { McpError } from "../errors";

export interface SelectResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export async function executeSelect(
  db: D1Database,
  sql: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<SelectResult> {
  const stmt = db.prepare(sql);
  const queryPromise = stmt.all();
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new McpError("SQL_TIMEOUT", `Query exceeded ${timeoutMs}ms.`)),
      timeoutMs
    );
  });

  let result;
  try {
    result = await Promise.race([queryPromise, timeoutPromise]);
  } catch (e) {
    if (e instanceof McpError) throw e;
    throw new McpError(
      "DB_ERROR",
      `Query failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const rows = (result as { results: Record<string, unknown>[] }).results;
  if (rows.length === 0) {
    return { columns: [], rows: [], rowCount: 0 };
  }
  const columns = Object.keys(rows[0]);
  const data = rows.map((r) => columns.map((c) => r[c]));
  return { columns, rows: data, rowCount: rows.length };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/mcp/sql-execute.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/sql/execute.ts tests/mcp/sql-execute.test.ts
git commit -m "Add D1 SELECT executor with timeout"
```

---

## Task 7: Stats tools (`get_global_stats`, `get_period_stats`, `get_streak`)

**Files:**
- Create: `src/mcp/tools/stats.ts`
- Test: `tests/mcp/tools-stats.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/mcp/tools-stats.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  getGlobalStatsTool,
  getPeriodStatsTool,
  getStreakTool,
} from "../../src/mcp/tools/stats";

function mockDb(row: Record<string, unknown>) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => row),
      })),
      first: vi.fn(async () => row),
      all: vi.fn(async () => ({ results: [] })),
    })),
  } as unknown as D1Database;
}

describe("getGlobalStatsTool", () => {
  it("returns global stats with no type filter", async () => {
    const db = mockDb({
      total_sessions: 42,
      total_ayahs: 1000,
      total_seconds: 7200,
      avg_ayahs: 23,
      avg_seconds: 171,
      total_pages: 50,
      total_page_seconds: 7000,
    });
    const r = await getGlobalStatsTool({ db, params: {} });
    expect(r.totalSessions).toBe(42);
    expect(r.totalAyahs).toBe(1000);
  });

  it("passes type filter", async () => {
    const db = mockDb({
      total_sessions: 5,
      total_ayahs: 100,
      total_seconds: 600,
      avg_ayahs: 20,
      avg_seconds: 120,
      total_pages: 4,
      total_page_seconds: 600,
    });
    const r = await getGlobalStatsTool({ db, params: { type: "kahf" } });
    expect(r.totalSessions).toBe(5);
  });
});

describe("getPeriodStatsTool", () => {
  it("returns week stats", async () => {
    const db = mockDb({ sessions: 3, ayahs: 50, seconds: 1800, pages: 5, page_seconds: 1800 });
    const r = await getPeriodStatsTool({
      db,
      tz: "America/Cancun",
      params: { period: "week" },
    });
    expect(r.sessions).toBe(3);
  });
});

describe("getStreakTool", () => {
  it("returns current and best streak", async () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(async () => ({
          results: [{ day: "2026-04-28" }, { day: "2026-04-27" }],
        })),
      })),
    } as unknown as D1Database;
    const r = await getStreakTool({ db, tz: "America/Cancun" });
    expect(r.currentStreak).toBe(2);
    expect(r.bestStreak).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

```bash
pnpm test tests/mcp/tools-stats.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/mcp/tools/stats.ts`**

```ts
import { z } from "zod";
import {
  calculateStreak,
  getGlobalStats,
  getPeriodStats,
} from "../../services/db/stats";
import { McpError } from "../errors";

const SessionTypeSchema = z.enum(["normal", "kahf"]).optional();

export const GetGlobalStatsParams = z.object({
  type: SessionTypeSchema,
});

export const GetPeriodStatsParams = z.object({
  period: z.enum(["week", "month"]),
  offset: z.number().int().min(0).max(120).optional().default(0),
});

export async function getGlobalStatsTool(input: {
  db: D1Database;
  params: z.infer<typeof GetGlobalStatsParams>;
}) {
  const r = await getGlobalStats(input.db, input.params.type);
  if (!r.ok) throw new McpError("DB_ERROR", r.error);
  return r.value;
}

export async function getPeriodStatsTool(input: {
  db: D1Database;
  tz: string;
  params: z.infer<typeof GetPeriodStatsParams>;
}) {
  const r = await getPeriodStats(
    input.db,
    input.params.period,
    input.tz,
    input.params.offset ?? 0
  );
  if (!r.ok) throw new McpError("DB_ERROR", r.error);
  return r.value;
}

export async function getStreakTool(input: {
  db: D1Database;
  tz: string;
}) {
  return await calculateStreak(input.db, input.tz);
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/mcp/tools-stats.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/stats.ts tests/mcp/tools-stats.test.ts
git commit -m "Add MCP tools: get_global_stats, get_period_stats, get_streak"
```

---

## Task 8: `get_sessions` tool

**Files:**
- Create: `src/mcp/tools/sessions.ts`
- Test: `tests/mcp/tools-sessions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/mcp/tools-sessions.test.ts
import { describe, expect, it, vi } from "vitest";
import { getSessionsTool, GetSessionsParams } from "../../src/mcp/tools/sessions";

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
      params: { from: "2026-04-01", to: "2026-04-30" },
    });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(1);
  });

  it("rejects invalid date format via schema", () => {
    const parsed = GetSessionsParams.safeParse({ from: "not-a-date", to: "2026-04-30" });
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
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/mcp/tools-sessions.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/mcp/tools/sessions.ts`**

```ts
import { z } from "zod";
import { mapRow } from "../../services/db/sessions";
import type { SessionRow } from "../../services/db/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const GetSessionsParams = z.object({
  from: z.string().regex(ISO_DATE, "from must be YYYY-MM-DD"),
  to: z.string().regex(ISO_DATE, "to must be YYYY-MM-DD"),
  type: z.enum(["normal", "kahf"]).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(200)
    .transform((v) => Math.min(v, 200)),
});

export async function getSessionsTool(input: {
  db: D1Database;
  params: z.infer<typeof GetSessionsParams>;
}) {
  const { from, to, type, limit } = input.params;
  const sql = type
    ? `SELECT * FROM sessions
        WHERE substr(started_at, 1, 10) BETWEEN ? AND ?
          AND type = ?
        ORDER BY started_at DESC
        LIMIT ?`
    : `SELECT * FROM sessions
        WHERE substr(started_at, 1, 10) BETWEEN ? AND ?
        ORDER BY started_at DESC
        LIMIT ?`;
  const built = type
    ? input.db.prepare(sql).bind(from, to, type, limit)
    : input.db.prepare(sql).bind(from, to, limit);
  const { results } = await built.all<SessionRow>();
  return results.map(mapRow);
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/mcp/tools-sessions.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/sessions.ts tests/mcp/tools-sessions.test.ts
git commit -m "Add MCP tool: get_sessions"
```

---

## Task 9: `get_khatmas` tool

**Files:**
- Create: `src/mcp/tools/khatmas.ts`
- Test: `tests/mcp/tools-khatmas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/mcp/tools-khatmas.test.ts
import { describe, expect, it, vi } from "vitest";
import { getKhatmasTool } from "../../src/mcp/tools/khatmas";

describe("getKhatmasTool", () => {
  it("returns khatmas ordered by completed_at desc", async () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(async () => ({
          results: [
            { id: 2, completed_at: "2026-04-01" },
            { id: 1, completed_at: "2025-10-15" },
          ],
        })),
      })),
    } as unknown as D1Database;
    const r = await getKhatmasTool({ db });
    expect(r).toHaveLength(2);
    expect(r[0].id).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/mcp/tools-khatmas.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/mcp/tools/khatmas.ts`**

```ts
export async function getKhatmasTool(input: { db: D1Database }) {
  const { results } = await input.db
    .prepare("SELECT id, completed_at FROM khatmas ORDER BY completed_at DESC")
    .all<{ id: number; completed_at: string }>();
  return results;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/mcp/tools-khatmas.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/khatmas.ts tests/mcp/tools-khatmas.test.ts
git commit -m "Add MCP tool: get_khatmas"
```

---

## Task 10: `get_recent_speed` tool

**Files:**
- Create: `src/mcp/tools/speed.ts`
- Test: `tests/mcp/tools-speed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/mcp/tools-speed.test.ts
import { describe, expect, it, vi } from "vitest";
import { getRecentSpeedTool } from "../../src/mcp/tools/speed";

describe("getRecentSpeedTool", () => {
  it("returns speed metrics from recent sessions", async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ total_seconds: 1400, total_pages: 7 })),
        })),
      })),
    } as unknown as D1Database;
    const r = await getRecentSpeedTool({
      db,
      tz: "America/Cancun",
      params: { days: 7 },
    });
    expect(r).not.toBeNull();
    if (r) {
      expect(r.secondsPerPage).toBe(200);
      expect(r.pagesPerDay).toBe(1);
    }
  });

  it("returns null when no pages in window", async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ total_seconds: 0, total_pages: 0 })),
        })),
      })),
    } as unknown as D1Database;
    const r = await getRecentSpeedTool({
      db,
      tz: "America/Cancun",
      params: { days: 7 },
    });
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/mcp/tools-speed.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/mcp/tools/speed.ts`**

```ts
import { z } from "zod";
import { getRecentPageStats } from "../../services/db/stats";

export const GetRecentSpeedParams = z.object({
  days: z.number().int().min(1).max(365).optional().default(7),
});

export async function getRecentSpeedTool(input: {
  db: D1Database;
  tz: string;
  params: z.infer<typeof GetRecentSpeedParams>;
}) {
  return await getRecentPageStats(input.db, input.tz, input.params.days);
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/mcp/tools-speed.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/speed.ts tests/mcp/tools-speed.test.ts
git commit -m "Add MCP tool: get_recent_speed"
```

---

## Task 11: `get_config` tool

**Files:**
- Create: `src/mcp/tools/config.ts`
- Test: `tests/mcp/tools-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/mcp/tools-config.test.ts
import { describe, expect, it, vi } from "vitest";
import { getConfigTool } from "../../src/mcp/tools/config";

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
    expect(r.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/mcp/tools-config.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/mcp/tools/config.ts`**

```ts
import { DEFAULT_CITY, DEFAULT_COUNTRY, DEFAULT_TZ } from "../../config";
import { getConfig } from "../../services/db/config";
import { getTodayInTimezone } from "../../services/db/date-helpers";

export async function getConfigTool(input: { db: D1Database }) {
  const [city, country, tz] = await Promise.all([
    getConfig(input.db, "city"),
    getConfig(input.db, "country"),
    getConfig(input.db, "timezone"),
  ]);
  const timezone = tz ?? DEFAULT_TZ;
  return {
    city: city ?? DEFAULT_CITY,
    country: country ?? DEFAULT_COUNTRY,
    timezone,
    today: getTodayInTimezone(timezone),
  };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/mcp/tools-config.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/config.ts tests/mcp/tools-config.test.ts
git commit -m "Add MCP tool: get_config"
```

---

## Task 12: Schema markdown generator script

**Files:**
- Create: `scripts/gen-schema.ts`
- Create: `src/mcp/resources/schema.md` (output, committed)
- Create: `src/mcp/resources/schema-text.ts` (output, committed, runtime import target)
- Modify: `package.json` (add script and `tsx` dev dep)
- Test: `tests/mcp/schema-snapshot.test.ts`

- [ ] **Step 1: Write the snapshot test**

```ts
// tests/mcp/schema-snapshot.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("schema markdown", () => {
  it("matches snapshot of generated content", () => {
    const md = readFileSync(
      join(__dirname, "..", "..", "src", "mcp", "resources", "schema.md"),
      "utf-8"
    );
    expect(md).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Implement `scripts/gen-schema.ts`**

The script writes two files: a human-readable `schema.md` (committed for audit) and a TypeScript module `schema-text.ts` exporting the same content as a string constant (imported at runtime by the tools and the MCP server, since Workers bundling does not load `.md` files directly).

```ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const md = `# Database schema

All datetimes are stored as text in UTC ("YYYY-MM-DD HH:MM:SS" or ISO 8601).
The user's timezone is in the \`config\` table (key \`timezone\`).

## sessions

| Column | Type | Notes |
|---|---|---|
| id | INTEGER | Primary key |
| started_at | TEXT | UTC datetime |
| duration_seconds | INTEGER | NULL when not recorded |
| page_start | INTEGER | NULL when not recorded. Range 1-604 (Madinah Mushaf) |
| page_end | INTEGER | NULL when not recorded. Inclusive |
| surah_start | INTEGER | 1-114 |
| ayah_start | INTEGER | 1-based ayah within \`surah_start\` |
| surah_end | INTEGER | 1-114 |
| ayah_end | INTEGER | 1-based ayah within \`surah_end\` |
| ayah_count | INTEGER | Source of truth for volume read |
| type | TEXT | 'normal' or 'kahf' (Friday Surat Al-Kahf) |
| created_at | TEXT | UTC |

## khatmas

A khatma is one full read-through of the Quran. One row per completion.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER | Primary key |
| completed_at | TEXT | Date the khatma was completed |

## config

Key/value store. Known keys: \`city\`, \`country\`, \`timezone\`, \`language\`,
\`chat_id\`, \`kahf_reminder_last\`, \`weekly_recap_last\`.

| Column | Type | Notes |
|---|---|---|
| key | TEXT | Primary key |
| value | TEXT | |

## prayer_cache

Daily prayer time cache. Mostly transient; not useful for reading-history analysis.

# Conventions

- Group sessions by user-day with \`substr(started_at, 1, 10)\`. Stored datetimes
  are already aligned to the user timezone at insertion time.
- "Streak" = number of consecutive days with at least one session.
- Mushaf used: Madinah, 604 pages.
- Surah names: see the \`get_surahs\` tool. Juz/page mapping: \`get_juz_pages\`.
`;

const resourcesDir = join(__dirname, "..", "src", "mcp", "resources");
writeFileSync(join(resourcesDir, "schema.md"), md);
writeFileSync(
  join(resourcesDir, "schema-text.ts"),
  `// Generated by scripts/gen-schema.ts. Do not edit by hand.\n` +
    `export const schemaMarkdown = ${JSON.stringify(md)};\n`
);
console.log("Wrote src/mcp/resources/schema.md and schema-text.ts");
```

- [ ] **Step 3: Add the script to `package.json`**

In the `"scripts"` block, add:

```json
"mcp:gen-schema": "tsx scripts/gen-schema.ts"
```

Install `tsx` as a dev dep:

```bash
pnpm add -D tsx
```

- [ ] **Step 4: Generate the files**

```bash
pnpm mcp:gen-schema
```
Expected: `Wrote src/mcp/resources/schema.md and schema-text.ts` and both files exist.

- [ ] **Step 5: Run the snapshot test, accept the snapshot**

```bash
pnpm test tests/mcp/schema-snapshot.test.ts
```
Expected: PASS (snapshot written on first run).

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-schema.ts src/mcp/resources/schema.md src/mcp/resources/schema-text.ts \
  package.json pnpm-lock.yaml tests/mcp/schema-snapshot.test.ts tests/mcp/__snapshots__
git commit -m "Add MCP schema markdown generator and committed schema artifacts"
```

---

## Task 13: Reference tools (`get_surahs`, `get_juz_pages`, `get_schema`)

**Files:**
- Create: `src/mcp/tools/reference.ts`
- Test: `tests/mcp/tools-reference.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/mcp/tools-reference.test.ts
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
    expect(r.map((s) => s.id).sort()).toEqual([1, 2, 18]);
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
```

- [ ] **Step 2: Run the tests, verify they fail**

```bash
pnpm test tests/mcp/tools-reference.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/mcp/tools/reference.ts`**

Inspect `src/data/surahs.ts` and `src/data/juz.ts` to confirm exported names. The implementation below assumes they export `surahs` (array of `{ id, name, arabicName, ayahCount }`) and `juzPages` (array of `{ juz, pageStart, pageEnd }`). If the actual exports differ, adapt the imports accordingly.

```ts
import { z } from "zod";
import { surahs } from "../../data/surahs";
import { juzPages } from "../../data/juz";
import { schemaMarkdown } from "../resources/schema-text";

export const GetSurahsParams = z.object({
  ids: z.array(z.number().int().min(1).max(114)).optional(),
});

export async function getSurahsTool(input: {
  params: z.infer<typeof GetSurahsParams>;
}) {
  const all = surahs.map((s) => ({
    id: s.id,
    name: s.name,
    arabic_name: s.arabicName,
    ayah_count: s.ayahCount,
  }));
  if (!input.params.ids || input.params.ids.length === 0) return all;
  const set = new Set(input.params.ids);
  return all.filter((s) => set.has(s.id));
}

export const GetJuzPagesParams = z.object({
  juz: z.number().int().min(1).max(30).optional(),
});

export async function getJuzPagesTool(input: {
  params: z.infer<typeof GetJuzPagesParams>;
}) {
  if (input.params.juz === undefined) return juzPages;
  return juzPages.filter((j) => j.juz === input.params.juz);
}

export const GetSchemaParams = z.object({
  table: z.string().optional(),
});

export async function getSchemaTool(input: {
  params: z.infer<typeof GetSchemaParams>;
}) {
  if (!input.params.table) return schemaMarkdown;
  // Naive section extraction by H2 headings
  const sections = schemaMarkdown.split(/\n## /);
  const match = sections.find((s) =>
    s.toLowerCase().startsWith(input.params.table!.toLowerCase())
  );
  return match ? `## ${match}` : schemaMarkdown;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/mcp/tools-reference.test.ts
```
Expected: PASS. The import works because `schema-text.ts` is a regular TypeScript module — no special bundler config needed.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/reference.ts tests/mcp/tools-reference.test.ts
git commit -m "Add MCP reference tools: get_surahs, get_juz_pages, get_schema"
```

---

## Task 14: `query_sql` tool

**Files:**
- Create: `src/mcp/tools/query-sql.ts`
- Test: `tests/mcp/tools-query-sql.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/mcp/tools-query-sql.test.ts
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
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/mcp/tools-query-sql.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/mcp/tools/query-sql.ts`**

```ts
import { z } from "zod";
import { executeSelect } from "../sql/execute";
import { validateSql } from "../sql/validator";

export const QuerySqlParams = z.object({
  sql: z.string().min(1).max(8000),
});

export async function querySqlTool(input: {
  db: D1Database;
  params: z.infer<typeof QuerySqlParams>;
}) {
  const validated = validateSql(input.params.sql);
  if (!validated.ok) throw validated.error;
  const result = await executeSelect(input.db, validated.value.normalizedSql);
  return { ...result, truncated: validated.value.injectedLimit };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/mcp/tools-query-sql.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/query-sql.ts tests/mcp/tools-query-sql.test.ts
git commit -m "Add MCP tool: query_sql with validator and timeout"
```

---

## Task 15: Auth session helpers (HMAC, code, hash, KV, rate limit)

**Files:**
- Create: `src/mcp/auth/session.ts`
- Test: `tests/mcp/auth-session.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/mcp/auth-session.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  generateCode,
  hashCode,
  signSessionId,
  verifySessionId,
} from "../../src/mcp/auth/session";

const SECRET = "test-secret-32-bytes-base64url-x";

describe("generateCode", () => {
  it("returns a 6-digit string", () => {
    const code = generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });
});

describe("hashCode", () => {
  it("is deterministic with same secret", async () => {
    const a = await hashCode("123456", SECRET);
    const b = await hashCode("123456", SECRET);
    expect(a).toBe(b);
  });

  it("differs from clear-text", async () => {
    const a = await hashCode("123456", SECRET);
    expect(a).not.toBe("123456");
  });
});

describe("signSessionId / verifySessionId", () => {
  it("round-trips", async () => {
    const signed = await signSessionId("abc123", SECRET);
    const verified = await verifySessionId(signed, SECRET);
    expect(verified).toBe("abc123");
  });

  it("returns null on tampered signature", async () => {
    const signed = await signSessionId("abc123", SECRET);
    const tampered = `${signed}x`;
    expect(await verifySessionId(tampered, SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

```bash
pnpm test tests/mcp/auth-session.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/mcp/auth/session.ts`**

```ts
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const padded = s.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    s.length + ((4 - (s.length % 4)) % 4),
    "="
  );
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = buf[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

export async function hashCode(code: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(code))
  );
  return toBase64Url(sig);
}

export async function signSessionId(
  id: string,
  secret: string
): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(id))
  );
  return `${id}.${toBase64Url(sig)}`;
}

export async function verifySessionId(
  signed: string,
  secret: string
): Promise<string | null> {
  const dot = signed.lastIndexOf(".");
  if (dot < 1) return null;
  const id = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const key = await importHmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(sig),
    encoder.encode(id)
  );
  return ok ? id : null;
}

export function newSessionId(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return toBase64Url(buf);
}

export interface LoginSessionRecord {
  oauthRequestId: string;
  codeHash: string;
  attempts: number;
  createdAt: number;
}

const LOGIN_TTL_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_S = 10 * 60;
const RATE_LIMIT_MAX = 3;

export async function putLoginSession(
  kv: KVNamespace,
  sessionId: string,
  rec: LoginSessionRecord
): Promise<void> {
  await kv.put(`login:${sessionId}`, JSON.stringify(rec), {
    expirationTtl: LOGIN_TTL_SECONDS,
  });
}

export async function getLoginSession(
  kv: KVNamespace,
  sessionId: string
): Promise<LoginSessionRecord | null> {
  const raw = await kv.get(`login:${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteLoginSession(
  kv: KVNamespace,
  sessionId: string
): Promise<void> {
  await kv.delete(`login:${sessionId}`);
}

export async function bumpAttempts(
  kv: KVNamespace,
  sessionId: string,
  rec: LoginSessionRecord
): Promise<number> {
  const updated = { ...rec, attempts: rec.attempts + 1 };
  if (updated.attempts >= MAX_ATTEMPTS) {
    await deleteLoginSession(kv, sessionId);
  } else {
    await kv.put(`login:${sessionId}`, JSON.stringify(updated), {
      expirationTtl: LOGIN_TTL_SECONDS,
    });
  }
  return MAX_ATTEMPTS - updated.attempts;
}

export async function checkAndBumpRateLimit(
  kv: KVNamespace,
  ip: string
): Promise<{ allowed: boolean; minutesUntilReset: number }> {
  const key = `login_rate:${ip}`;
  const raw = await kv.get(key);
  const now = Math.floor(Date.now() / 1000);
  let count = 1;
  let resetAt = now + RATE_LIMIT_WINDOW_S;
  if (raw) {
    const parsed = JSON.parse(raw) as { count: number; resetAt: number };
    if (parsed.resetAt > now) {
      count = parsed.count + 1;
      resetAt = parsed.resetAt;
    }
  }
  await kv.put(key, JSON.stringify({ count, resetAt }), {
    expirationTtl: RATE_LIMIT_WINDOW_S,
  });
  if (count > RATE_LIMIT_MAX) {
    const minutes = Math.max(1, Math.ceil((resetAt - now) / 60));
    return { allowed: false, minutesUntilReset: minutes };
  }
  return { allowed: true, minutesUntilReset: 0 };
}

export const LOGIN_TTL_SECONDS_EXPORT = LOGIN_TTL_SECONDS;
export const MAX_ATTEMPTS_EXPORT = MAX_ATTEMPTS;
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/mcp/auth-session.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/auth/session.ts tests/mcp/auth-session.test.ts
git commit -m "Add MCP auth session helpers: HMAC, code hashing, KV, rate limit"
```

---

## Task 16: Send Telegram code helper

**Files:**
- Create: `src/mcp/auth/telegram-code.ts`
- Test: covered by handler tests

- [ ] **Step 1: Implement directly (single small function, exercised by Task 18 tests)**

```ts
import type { Locale } from "../../locales/types";

export async function sendTelegramCode(
  botToken: string,
  chatId: string,
  code: string,
  t: Locale
): Promise<boolean> {
  const text = t.mcpTelegramCode(code);
  const r = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  );
  if (!r.ok) {
    console.error(`Telegram sendMessage HTTP ${r.status}`);
    return false;
  }
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mcp/auth/telegram-code.ts
git commit -m "Add Telegram code sender for MCP login"
```

---

## Task 17: Login pages renderer

**Files:**
- Create: `src/mcp/auth/pages.ts`
- Test: `tests/mcp/auth-pages.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/mcp/auth-pages.test.ts
import { describe, expect, it } from "vitest";
import { en } from "../../src/locales/en";
import { fr } from "../../src/locales/fr";
import { ar } from "../../src/locales/ar";
import { renderLoginPage } from "../../src/mcp/auth/pages";

describe("renderLoginPage snapshots", () => {
  for (const [name, t] of [
    ["en", en],
    ["fr", fr],
    ["ar", ar],
  ] as const) {
    it(`request page (${name})`, () => {
      const html = renderLoginPage(t, "request", { signedSessionId: "" });
      expect(html).toMatchSnapshot();
    });
    it(`verify page (${name})`, () => {
      const html = renderLoginPage(t, "verify", {
        signedSessionId: "abc.def",
      });
      expect(html).toMatchSnapshot();
    });
  }
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/mcp/auth-pages.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/mcp/auth/pages.ts`**

```ts
import type { Locale } from "../../locales/types";

interface RenderContext {
  signedSessionId: string;
  errorMessage?: string;
  notice?: string;
  redirectQuery?: string;
}

function escape(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const baseStyles = `
  body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; max-width: 480px; margin-inline: auto; }
  h1 { font-size: 1.4rem; }
  form { display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; }
  button { padding: 0.75rem 1rem; font-size: 1rem; cursor: pointer; }
  input { padding: 0.75rem; font-size: 1.2rem; letter-spacing: 0.2em; text-align: center; }
  .notice { color: #2a7a2a; }
  .error { color: #b00020; }
`;

export function renderLoginPage(
  t: Locale,
  state: "request" | "verify",
  ctx: RenderContext
): string {
  const action =
    state === "request" ? "/oauth/login/request" : "/oauth/login/verify";
  const inner =
    state === "request"
      ? `
        <p>${escape(t.mcpLogin.intro)}</p>
        <form method="post" action="${action}${ctx.redirectQuery ?? ""}">
          <button type="submit">${escape(t.mcpLogin.sendCodeButton)}</button>
        </form>
      `
      : `
        ${ctx.notice ? `<p class="notice">${escape(ctx.notice)}</p>` : ""}
        ${ctx.errorMessage ? `<p class="error">${escape(ctx.errorMessage)}</p>` : ""}
        <form method="post" action="${action}">
          <input type="hidden" name="session_id" value="${escape(ctx.signedSessionId)}">
          <label for="code">${escape(t.mcpLogin.codeInputLabel)}</label>
          <input id="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required>
          <button type="submit">${escape(t.mcpLogin.verifyButton)}</button>
        </form>
      `;
  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(t.mcpLogin.pageTitle)}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <h1>${escape(t.mcpLogin.heading)}</h1>
  ${inner}
</body>
</html>`;
}
```

- [ ] **Step 4: Run the tests, verify snapshots are written**

```bash
pnpm test tests/mcp/auth-pages.test.ts
```
Expected: PASS (six snapshots written on first run).

- [ ] **Step 5: Commit**

```bash
git add src/mcp/auth/pages.ts tests/mcp/auth-pages.test.ts tests/mcp/__snapshots__
git commit -m "Add MCP login page renderer with locale snapshots"
```

---

## Task 18: Login handlers (`/oauth/authorize`, `/oauth/login/request`, `/oauth/login/verify`)

**Files:**
- Create: `src/mcp/auth/handlers.ts`
- Test: `tests/mcp/auth-handlers.test.ts`

The handlers receive an OAuth provider helper that exposes `parseAuthRequest(request)` and `completeAuthorization(request, ...)`. Until Task 19 wires the provider, the handler signatures use a typed interface so tests can mock it.

- [ ] **Step 1: Write the failing tests (focused on request handler core flow)**

```ts
// tests/mcp/auth-handlers.test.ts
import { describe, expect, it, vi } from "vitest";
import { handleLoginRequest } from "../../src/mcp/auth/handlers";

const SECRET = "test-secret";
const env = {
  MCP_SESSION_HMAC_SECRET: SECRET,
  BOT_TOKEN: "fake",
  ALLOWED_USER_ID: "12345",
  OAUTH_KV: {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    delete: vi.fn(async () => undefined),
  } as unknown as KVNamespace,
  DB: {} as unknown as D1Database,
};

describe("handleLoginRequest", () => {
  it("creates a login session and returns the verify page", async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
    const req = new Request("https://example/oauth/login/request", {
      method: "POST",
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    const provider = {
      parseAuthRequest: vi.fn(async () => ({ requestId: "req-1" })),
    };
    const r = await handleLoginRequest(req, env, provider as never);
    expect(r.status).toBe(200);
    expect(env.OAUTH_KV.put).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/mcp/auth-handlers.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/mcp/auth/handlers.ts`**

```ts
import { getLocale } from "../../locales";
import { getConfig } from "../../services/db/config";
import { renderLoginPage } from "./pages";
import {
  bumpAttempts,
  checkAndBumpRateLimit,
  deleteLoginSession,
  generateCode,
  getLoginSession,
  hashCode,
  newSessionId,
  putLoginSession,
  signSessionId,
  verifySessionId,
} from "./session";
import { sendTelegramCode } from "./telegram-code";

export interface OAuthProviderShim {
  parseAuthRequest(request: Request): Promise<{ requestId: string }>;
  completeAuthorization(opts: {
    request: Request;
    requestId: string;
    userId: string;
    metadata?: Record<string, unknown>;
  }): Promise<Response>;
}

interface Env {
  ALLOWED_USER_ID: string;
  BOT_TOKEN: string;
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  MCP_SESSION_HMAC_SECRET: string;
}

async function loadLocale(db: D1Database) {
  const lang = await getConfig(db, "language");
  return getLocale(lang);
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function handleAuthorize(
  request: Request,
  env: Env,
  provider: OAuthProviderShim
): Promise<Response> {
  const t = await loadLocale(env.DB);
  // The OAuth library needs the original auth request to be parsed and remembered.
  // We parse here just to validate; the request_id is reused on submit.
  await provider.parseAuthRequest(request);
  const url = new URL(request.url);
  const redirectQuery = url.search; // "?response_type=...&client_id=...&..."
  return htmlResponse(
    renderLoginPage(t, "request", { signedSessionId: "", redirectQuery })
  );
}

export async function handleLoginRequest(
  request: Request,
  env: Env,
  provider: OAuthProviderShim
): Promise<Response> {
  const t = await loadLocale(env.DB);
  const ip = request.headers.get("cf-connecting-ip") ?? "0.0.0.0";

  const rate = await checkAndBumpRateLimit(env.OAUTH_KV, ip);
  if (!rate.allowed) {
    return htmlResponse(
      renderLoginPage(t, "request", {
        signedSessionId: "",
        errorMessage: t.mcpLogin.errorRateLimited(rate.minutesUntilReset),
      }),
      429
    );
  }

  const oauthReq = await provider.parseAuthRequest(request);
  const code = generateCode();
  const codeHash = await hashCode(code, env.MCP_SESSION_HMAC_SECRET);
  const sessionId = newSessionId();
  await putLoginSession(env.OAUTH_KV, sessionId, {
    oauthRequestId: oauthReq.requestId,
    codeHash,
    attempts: 0,
    createdAt: Math.floor(Date.now() / 1000),
  });

  const sent = await sendTelegramCode(
    env.BOT_TOKEN,
    env.ALLOWED_USER_ID,
    code,
    t
  );
  if (!sent) {
    await deleteLoginSession(env.OAUTH_KV, sessionId);
    return htmlResponse(
      renderLoginPage(t, "request", {
        signedSessionId: "",
        errorMessage: t.mcpLogin.errorTelegramSend,
      }),
      502
    );
  }

  const signed = await signSessionId(sessionId, env.MCP_SESSION_HMAC_SECRET);
  return htmlResponse(
    renderLoginPage(t, "verify", {
      signedSessionId: signed,
      notice: t.mcpLogin.codeSentNotice,
    })
  );
}

export async function handleLoginVerify(
  request: Request,
  env: Env,
  provider: OAuthProviderShim
): Promise<Response> {
  const t = await loadLocale(env.DB);
  const form = await request.formData();
  const signed = form.get("session_id");
  const submitted = form.get("code");

  const sessionId =
    typeof signed === "string"
      ? await verifySessionId(signed, env.MCP_SESSION_HMAC_SECRET)
      : null;
  if (!sessionId) {
    return htmlResponse(
      renderLoginPage(t, "request", {
        signedSessionId: "",
        errorMessage: t.mcpLogin.errorExpired,
      }),
      400
    );
  }

  const rec = await getLoginSession(env.OAUTH_KV, sessionId);
  if (!rec) {
    return htmlResponse(
      renderLoginPage(t, "request", {
        signedSessionId: "",
        errorMessage: t.mcpLogin.errorExpired,
      }),
      400
    );
  }

  if (typeof submitted !== "string" || !/^\d{6}$/.test(submitted)) {
    return htmlResponse(
      renderLoginPage(t, "verify", {
        signedSessionId: signed as string,
        errorMessage: t.mcpLogin.errorWrongCode(3 - rec.attempts),
      }),
      400
    );
  }

  const submittedHash = await hashCode(submitted, env.MCP_SESSION_HMAC_SECRET);
  if (submittedHash !== rec.codeHash) {
    const remaining = await bumpAttempts(env.OAUTH_KV, sessionId, rec);
    if (remaining <= 0) {
      return htmlResponse(
        renderLoginPage(t, "request", {
          signedSessionId: "",
          errorMessage: t.mcpLogin.errorExpired,
        }),
        400
      );
    }
    return htmlResponse(
      renderLoginPage(t, "verify", {
        signedSessionId: signed as string,
        errorMessage: t.mcpLogin.errorWrongCode(remaining),
      }),
      400
    );
  }

  await deleteLoginSession(env.OAUTH_KV, sessionId);
  return await provider.completeAuthorization({
    request,
    requestId: rec.oauthRequestId,
    userId: env.ALLOWED_USER_ID,
  });
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/mcp/auth-handlers.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/auth/handlers.ts tests/mcp/auth-handlers.test.ts
git commit -m "Add MCP OAuth login handlers (authorize, request, verify)"
```

---

## Task 19: OAuth provider configuration

**Files:**
- Create: `src/mcp/auth/provider.ts`

The `@cloudflare/workers-oauth-provider` library binds custom routes to a provider instance. Configure it to use our login handlers and KV namespace.

- [ ] **Step 1: Implement `src/mcp/auth/provider.ts`**

Inspect the library's actual API by running:
```bash
pnpm exec -- node -e "console.log(Object.keys(require('@cloudflare/workers-oauth-provider')))"
```
The library exports an `OAuthProvider` constructor. Adapt the configuration below if the field names differ in the version installed:

```ts
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import {
  handleAuthorize,
  handleLoginRequest,
  handleLoginVerify,
  type OAuthProviderShim,
} from "./handlers";

interface Env {
  ALLOWED_USER_ID: string;
  BOT_TOKEN: string;
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  MCP_SESSION_HMAC_SECRET: string;
}

export function createOAuthProvider(env: Env) {
  return new OAuthProvider({
    apiRoute: "/mcp",
    apiHandler: {
      // Defined by the MCP server in Task 20
      fetch: () => new Response("MCP route not bound", { status: 500 }),
    },
    defaultHandler: {
      // The provider passes auth-related requests through this handler
      fetch: async (request: Request, parsed: OAuthProviderShim) => {
        const url = new URL(request.url);
        if (url.pathname === "/oauth/authorize" && request.method === "GET") {
          return handleAuthorize(request, env, parsed);
        }
        if (
          url.pathname === "/oauth/login/request" &&
          request.method === "POST"
        ) {
          return handleLoginRequest(request, env, parsed);
        }
        if (
          url.pathname === "/oauth/login/verify" &&
          request.method === "POST"
        ) {
          return handleLoginVerify(request, env, parsed);
        }
        return new Response("Not found", { status: 404 });
      },
    },
    authorizeEndpoint: "/oauth/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    scopesSupported: ["mcp:read"],
    accessTokenTTL: 60 * 60,         // 1 hour
    refreshTokenTTL: 30 * 24 * 60 * 60, // 30 days
    kvNamespace: env.OAUTH_KV,
  });
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check
```
Expected: no errors. If the library's option names differ, fix them now and rerun.

- [ ] **Step 3: Commit**

```bash
git add src/mcp/auth/provider.ts
git commit -m "Add OAuth provider configuration for MCP"
```

---

## Task 20: MCP server with SSE transport

**Files:**
- Create: `src/mcp/server.ts`

- [ ] **Step 1: Implement `src/mcp/server.ts`**

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { schemaMarkdown } from "./resources/schema-text";
import { McpError } from "./errors";
import {
  GetGlobalStatsParams,
  GetPeriodStatsParams,
  getGlobalStatsTool,
  getPeriodStatsTool,
  getStreakTool,
} from "./tools/stats";
import { GetSessionsParams, getSessionsTool } from "./tools/sessions";
import { getKhatmasTool } from "./tools/khatmas";
import { GetRecentSpeedParams, getRecentSpeedTool } from "./tools/speed";
import { getConfigTool } from "./tools/config";
import {
  GetJuzPagesParams,
  GetSchemaParams,
  GetSurahsParams,
  getJuzPagesTool,
  getSchemaTool,
  getSurahsTool,
} from "./tools/reference";
import { QuerySqlParams, querySqlTool } from "./tools/query-sql";
import { DEFAULT_TZ } from "../config";
import { getConfig } from "../services/db/config";

interface Env {
  DB: D1Database;
}

const QUERY_SQL_DESCRIPTION = `Run a read-only SELECT against the user's reading data.

Tables (compact):
- sessions(id, started_at, duration_seconds, page_start, page_end, surah_start, ayah_start, surah_end, ayah_end, ayah_count, type, created_at)
- khatmas(id, completed_at)
- config(key, value)

Rules: SELECT only. No multi-statement. No \`sqlite_*\` tables. LIMIT auto-injected at 500 (max 1000).
Call \`get_schema\` for the full reference.`;

async function loadTz(db: D1Database): Promise<string> {
  return (await getConfig(db, "timezone")) ?? DEFAULT_TZ;
}

export function createMcpServer(env: Env): Server {
  const server = new Server(
    { name: "quran-tracker", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler("tools/list", async () => ({
    tools: [
      { name: "get_global_stats", description: "Total sessions, ayahs, pages, time across all history.", inputSchema: GetGlobalStatsParams.shape },
      { name: "get_period_stats", description: "Aggregate stats for a week or month, optionally offset back.", inputSchema: GetPeriodStatsParams.shape },
      { name: "get_streak", description: "Current and best consecutive-day streaks.", inputSchema: {} },
      { name: "get_khatmas", description: "List of completed khatmas (full Quran reads).", inputSchema: {} },
      { name: "get_recent_speed", description: "Reading speed over the last N days.", inputSchema: GetRecentSpeedParams.shape },
      { name: "get_sessions", description: "Sessions in a date range. Capped at 200 rows.", inputSchema: GetSessionsParams.shape },
      { name: "get_config", description: "City, country, timezone, and today's date.", inputSchema: {} },
      { name: "get_surahs", description: "Surah metadata: id, transliterated name, Arabic name, ayah count.", inputSchema: GetSurahsParams.shape },
      { name: "get_juz_pages", description: "Juz to page-range mapping.", inputSchema: GetJuzPagesParams.shape },
      { name: "get_schema", description: "Full database schema documentation in markdown.", inputSchema: GetSchemaParams.shape },
      { name: "query_sql", description: QUERY_SQL_DESCRIPTION, inputSchema: QuerySqlParams.shape },
    ],
  }));

  server.setRequestHandler("tools/call", async (req) => {
    const { name, arguments: args } = req.params as {
      name: string;
      arguments: Record<string, unknown>;
    };
    try {
      switch (name) {
        case "get_global_stats":
          return wrap(await getGlobalStatsTool({ db: env.DB, params: GetGlobalStatsParams.parse(args ?? {}) }));
        case "get_period_stats":
          return wrap(await getPeriodStatsTool({ db: env.DB, tz: await loadTz(env.DB), params: GetPeriodStatsParams.parse(args ?? {}) }));
        case "get_streak":
          return wrap(await getStreakTool({ db: env.DB, tz: await loadTz(env.DB) }));
        case "get_khatmas":
          return wrap(await getKhatmasTool({ db: env.DB }));
        case "get_recent_speed":
          return wrap(await getRecentSpeedTool({ db: env.DB, tz: await loadTz(env.DB), params: GetRecentSpeedParams.parse(args ?? {}) }));
        case "get_sessions":
          return wrap(await getSessionsTool({ db: env.DB, params: GetSessionsParams.parse(args ?? {}) }));
        case "get_config":
          return wrap(await getConfigTool({ db: env.DB }));
        case "get_surahs":
          return wrap(await getSurahsTool({ params: GetSurahsParams.parse(args ?? {}) }));
        case "get_juz_pages":
          return wrap(await getJuzPagesTool({ params: GetJuzPagesParams.parse(args ?? {}) }));
        case "get_schema":
          return wrap(await getSchemaTool({ params: GetSchemaParams.parse(args ?? {}) }));
        case "query_sql":
          return wrap(await querySqlTool({ db: env.DB, params: QuerySqlParams.parse(args ?? {}) }));
        default:
          throw new McpError("INVALID_PARAMS", `Unknown tool: ${name}`);
      }
    } catch (e) {
      if (e instanceof McpError) {
        return wrapError(e.code, e.message);
      }
      console.error("MCP tool error:", e);
      return wrapError(
        "DB_ERROR",
        e instanceof Error ? e.message : String(e)
      );
    }
  });

  server.setRequestHandler("resources/list", async () => ({
    resources: [
      {
        uri: "schema://database",
        name: "schema",
        title: "Database schema",
        mimeType: "text/markdown",
      },
    ],
  }));

  server.setRequestHandler("resources/read", async (req) => {
    const { uri } = req.params as { uri: string };
    if (uri !== "schema://database") {
      throw new McpError("INVALID_PARAMS", `Unknown resource: ${uri}`);
    }
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: schemaMarkdown,
        },
      ],
    };
  });

  return server;
}

function wrap(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function wrapError(code: string, message: string) {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ code, message }) }],
  };
}

export async function handleMcpSse(
  request: Request,
  env: Env
): Promise<Response> {
  const server = createMcpServer(env);
  const transport = new SSEServerTransport("/mcp/message", request);
  await server.connect(transport);
  return transport.response;
}

export async function handleMcpMessage(
  request: Request,
  env: Env
): Promise<Response> {
  // Forwarded by SSE transport — server is already running on the SSE side.
  // The transport is stateless across requests on Workers; the SDK route is /mcp/message.
  // If the SDK requires a session table, this is the place to look it up.
  // For single-user, we re-create per request.
  const server = createMcpServer(env);
  const transport = new SSEServerTransport("/mcp/message", request);
  await server.connect(transport);
  return transport.response;
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check
```
Expected: no errors. If the SDK API differs from what this code assumes, adjust now (the SSE transport class names changed across MCP SDK versions).

- [ ] **Step 3: Commit**

```bash
git add src/mcp/server.ts
git commit -m "Wire MCP server with all tools, resources, and SSE transport"
```

---

## Task 21: MCP/OAuth router and integration into root fetch

**Files:**
- Create: `src/mcp/index.ts`
- Modify: `src/index.ts:361-393` (root fetch handler)

- [ ] **Step 1: Create `src/mcp/index.ts`**

```ts
import { createOAuthProvider } from "./auth/provider";
import { handleMcpMessage, handleMcpSse } from "./server";

interface Env {
  ALLOWED_USER_ID: string;
  BOT_TOKEN: string;
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  MCP_SESSION_HMAC_SECRET: string;
}

export async function handleMcpOrOAuthRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const provider = createOAuthProvider(env);

  if (url.pathname === "/mcp/sse") {
    // The provider validates the bearer token and forwards to apiHandler.
    // We override apiHandler here to delegate to the MCP server.
    return await provider.fetch(request, {
      ...env,
      apiHandler: { fetch: (req: Request) => handleMcpSse(req, env) },
    } as never);
  }
  if (url.pathname === "/mcp/message") {
    return await provider.fetch(request, {
      ...env,
      apiHandler: { fetch: (req: Request) => handleMcpMessage(req, env) },
    } as never);
  }
  // OAuth metadata, register, authorize, token, revoke, login/* all go through the provider
  return await provider.fetch(request, env as never);
}
```

- [ ] **Step 2: Modify `src/index.ts` root fetch**

Replace lines 361-393 with:

```ts
import { handleMcpOrOAuthRequest } from "./mcp";

// ...existing code unchanged above...

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === "/mcp/sse" ||
      url.pathname === "/mcp/message" ||
      url.pathname.startsWith("/oauth/") ||
      url.pathname === "/.well-known/oauth-authorization-server"
    ) {
      return handleMcpOrOAuthRequest(request, env);
    }

    if (url.pathname === "/setup") {
      // ...existing /setup logic unchanged...
    }
    const bot = createBot(env.BOT_TOKEN, env.DB, env.ALLOWED_USER_ID);
    return webhookCallback(bot, "cloudflare-mod")(request);
  },

  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(handleScheduled(env.DB, env.BOT_TOKEN));
  },
};
```

(Keep the existing `/setup` block in place — only add the MCP/OAuth dispatch at the top.)

- [ ] **Step 3: Type-check**

```bash
pnpm type-check
```
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

```bash
pnpm test
```
Expected: all tests still pass.

- [ ] **Step 5: Run lint/format**

```bash
pnpm check
```
Expected: no errors after auto-fix.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/index.ts src/index.ts
git commit -m "Wire MCP and OAuth routes into the root worker"
```

---

## Task 22: Manual smoke test

**Files:** none (manual procedure)

- [ ] **Step 1: Apply migrations and start dev server**

```bash
pnpm exec wrangler d1 execute quran-tracker --local --file=schema.sql
pnpm dev
```
Expected: dev server running on `http://127.0.0.1:8787`.

- [ ] **Step 2: Curl the OAuth metadata endpoint**

```bash
curl http://127.0.0.1:8787/.well-known/oauth-authorization-server | jq .
```
Expected: a JSON object listing `authorization_endpoint`, `token_endpoint`, `registration_endpoint`.

- [ ] **Step 3: Register the connector in Claude.ai**

Open Claude.ai → Settings → Connectors → Add custom connector → enter
`http://127.0.0.1:8787/mcp/sse` (or the deployed URL once Task 23 has run).
Expected: Claude.ai redirects to your worker's `/oauth/authorize` page (page 1, with the locale's "Send code" button).

- [ ] **Step 4: Click "Send code", confirm Telegram delivery**

Expected: a message in your Telegram from the bot with a 6-digit code.

- [ ] **Step 5: Enter the code on page 2**

Expected: redirected back to Claude.ai, connector now shows "Connected".

- [ ] **Step 6: Test each tool from a Claude conversation**

Open a new chat with the connector enabled and try, one by one:

- "What's my current streak?" → should call `get_streak`.
- "How many sessions did I do this month?" → `get_period_stats`.
- "Total ayahs ever?" → `get_global_stats`.
- "Sessions in the last 3 days?" → `get_sessions`.
- "How many khatmas?" → `get_khatmas`.
- "Reading speed last 30 days?" → `get_recent_speed`.
- "Show me ayah counts grouped by surah, top 10" → `query_sql`.

Expected: each call returns and Claude integrates the data into its answer.

- [ ] **Step 7: Test SQL guardrails**

In a chat: "Run this SQL: `DELETE FROM sessions`" — Claude should refuse or relay the rejection. If asked, it should explain that the server returned `SQL_NOT_SELECT`.

- [ ] **Step 8: Deploy**

```bash
pnpm deploy
```
Expected: deploy succeeds, MCP endpoints are live on the production URL.

- [ ] **Step 9: Re-test OAuth + one tool call against production**

Replace the connector URL in Claude.ai with the production URL, redo Step 3-5, and call `get_streak` once.

- [ ] **Step 10: Final commit if any small fixes were needed during smoke**

```bash
git add -A
git commit -m "Smoke-test fixes for MCP server"
```
(Skip if no changes.)

---

## Notes for the implementer

- **Library API drift.** Two libraries can have moved between when this plan was
  written and when it is executed: `@modelcontextprotocol/sdk` (especially the SSE
  transport class) and `@cloudflare/workers-oauth-provider` (option names on
  `OAuthProvider`). When in doubt, read the current README in
  `node_modules/<lib>/README.md` and adapt the calls — the behaviour required
  is unchanged.
- **Single-user assumption.** The OAuth provider issues tokens against
  `env.ALLOWED_USER_ID`. There is no user table; the userId is a constant.
- **D1 binding alias.** The spec mentions a possible `DB_RO` alias as
  documentation. This plan does not add one — no functional difference.
- **Audit log.** Out of scope for v1 (see spec Open questions).
