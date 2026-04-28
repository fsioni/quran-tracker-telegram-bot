# MCP Data Chat — Design

**Date:** 2026-04-28
**Status:** Approved (awaiting implementation plan)
**Branch:** `fsioni/mcp-data-chat`

## Goal

Expose the Quran Tracker bot's data via a remote, read-only MCP server so the
single user can have ad-hoc, conversational analyses of their reading history
from the Claude app (web and mobile).

The server is purely for reading and reasoning over data. Adding sessions,
editing entries, or any other mutation stays in the existing Telegram bot
surface and is explicitly out of scope.

## Use cases

The four use cases the design must serve well:

1. **Ad-hoc introspection** — "What was my best month this year?", "How many
   sessions after Fajr vs after Isha?", "Which surah do I read most often?".
   Questions that the bot's pre-defined commands don't answer.
2. **Patterns and coaching** — "Find my habits: when do I drop off, when am I
   most consistent, what precedes a multi-day gap?". Behavioural reflection on
   top of raw numbers.
3. **Narrative recap** — "Summarise my last khatma: total time, pace, surahs
   that took longest". Free-text generation from numerical history.
4. **Planning** — "If I want to finish a khatma before Ramadan, what pace given
   my history?". Mixing user data with a target.

Out of scope for v1:

- Data debugging / integrity checks (overlapping sessions, missing
  `page_end`, etc.). Could be added later as another tool but not needed to
  ship the four primary use cases.
- Any write path. The MCP is strictly read-only.

## Architecture

A single Cloudflare Worker continues to serve the existing Telegram webhook
and additionally exposes MCP and OAuth endpoints. Routing in `src/index.ts`
dispatches between the two surfaces by URL path.

```
Claude.ai/mobile ── OAuth dance ──► Worker /oauth/*    ─► OAUTH_KV
Claude.ai/mobile ── MCP SSE ──────► Worker /mcp/sse    ─► tools ─► D1
                                                       └► resources ─► D1
Telegram         ── webhook  ──────► Worker POST /     ─► existing handlers
```

### Code layout

```
src/
  mcp/
    server.ts            # Setup MCP server, register tools/resources
    tools/
      index.ts           # Tool registry
      stats.ts           # get_global_stats, get_period_stats, get_streak
      sessions.ts        # get_sessions
      khatmas.ts         # get_khatmas
      speed.ts           # get_recent_speed
      config.ts          # get_config
      reference.ts       # get_surahs, get_juz_pages, get_schema
      query-sql.ts       # query_sql + guardrails
    resources/
      schema.ts          # schema://database resource handler
      schema.md          # generated content (committed for audit)
    sql/
      validator.ts       # AST-based SQL validation, LIMIT injection
      execute.ts         # D1 wrapper with timeout
    auth/
      provider.ts        # OAuthProvider configuration
      login.ts           # GET /oauth/authorize, POST /oauth/login/{request,verify}
      session.ts         # HMAC signing, code hashing, KV ops
      pages.ts           # HTML templates for login pages 1 & 2
    errors.ts            # McpError + error codes
    index.ts             # MCP/OAuth router
  index.ts               # Root router: /mcp/* and /oauth/* → mcp, else Telegram
scripts/
  gen-schema.ts          # Regenerate src/mcp/resources/schema.md from schema.sql
tests/
  mcp/
    sql-validator.test.ts
    tools.test.ts
    auth-login.test.ts
    schema-snapshot.test.ts
```

The MCP layer is a thin presentation layer on top of `src/services/db/*`. No
business logic is duplicated; tools wrap existing functions, validate
parameters, and serialise responses.

### Dependencies added

- `@modelcontextprotocol/sdk` — MCP server with SSE transport for Workers.
- `@cloudflare/workers-oauth-provider` — OAuth 2.1 flow, dynamic client
  registration, PKCE, KV-backed token store.
- `node-sql-parser` — SQLite AST parser used by the validator.
- `zod` — input schemas for tool parameters (already a transitive dep via
  the MCP SDK; pinned explicitly).

### Wrangler bindings

```toml
[[kv_namespaces]]
binding = "OAUTH_KV"
id = "..."   # to provision
```

Secrets:

- `MCP_SESSION_HMAC_SECRET` — 32 random bytes, used to sign login
  `session_id` hidden form fields.
- `BOT_TOKEN` — already present, reused to send Telegram codes.

## Tools

All tools are read-only. They mirror functions already in
`src/services/db/*` and add only parameter validation and serialisation.
Durations are returned as raw seconds so the LLM can format them in the
conversation's language.

### High-level tools (curated)

| Tool | Parameters | Returns |
|---|---|---|
| `get_global_stats` | `type?: "normal" \| "kahf"` | total sessions, ayahs, pages, seconds, averages |
| `get_period_stats` | `period: "week" \| "month"`, `offset?: int (0=current, 1=prev, ...)` | sessions, ayahs, pages, seconds for the window |
| `get_streak` | — | `{ currentStreak, bestStreak }` |
| `get_khatmas` | — | `[{ id, completed_at }]` ordered desc |
| `get_recent_speed` | `days?: int = 7` | `{ secondsPerPage, pagesPerDay }` (or null when not enough data) |
| `get_sessions` | `from: ISO date`, `to: ISO date`, `type?`, `limit?: int (max 200)` | array of full session rows |
| `get_config` | — | `{ city, country, timezone, today }` (today computed in tz) |

Notes:

- `get_sessions` is hard-capped at 200 rows. Larger pulls go through
  `query_sql`.
- No `format_duration` server-side — formatting is the LLM's job.
- No prayer-time tool in v1. Can be added later if usage motivates it.

### `query_sql` (escape hatch)

Signature:

```ts
query_sql({ sql: string }) -> {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
}
```

Server-side validation (in order, before any D1 call):

1. Parse with `node-sql-parser` in SQLite dialect. Must be exactly one
   `Statement` of type `select`. Anything else
   (`insert`/`update`/`delete`/`drop`/`alter`/`create`/`pragma`/`attach`/
   `detach`/`vacuum`/`replace`/transactions) is rejected with
   `SQL_NOT_SELECT`.
2. Reject any `FROM`/`JOIN` referencing `sqlite_master`, `sqlite_sequence`,
   or `sqlite_schema` with `SQL_FORBIDDEN_TABLE`.
3. Walk AST nodes for `function` / `aggr_func`. Anything not in the
   whitelist (standard aggregates, date/time, math, string functions) is
   rejected with `SQL_FORBIDDEN_FUNCTION`. Whitelist is defined in
   `sql/validator.ts` and reviewed at code review time.
4. Inject `LIMIT 500` if absent. Clamp existing `LIMIT` to 1000. The
   response carries `truncated: true` whenever the LIMIT was injected or
   clamped.
5. Execute via `Promise.race` with a 10-second timeout
   (`SQL_TIMEOUT`).

The security model relies entirely on the parser-based validation plus the
fact that no MCP tool accepts a write path. D1 has no native read-only
mode; an alias binding (e.g. `DB_RO`) may be added as documentation but is
not a security boundary.

### Reference tools

| Tool | Parameters | Returns |
|---|---|---|
| `get_schema` | `table?: string` | Full schema markdown (single table or all) |
| `get_surahs` | `ids?: int[]` | `[{ id, name, arabic_name, ayah_count }]`, all 114 if no ids |
| `get_juz_pages` | `juz?: int` | `{ juz, pageStart, pageEnd }` (single or all) |

The compact schema lives directly in the `query_sql` tool description
(~400 bytes: table names + key columns + types). The full schema markdown
is fetched on demand via `get_schema`.

## Resources

A single resource, mirroring the schema documentation for users who want to
attach it manually in Claude.ai's "+ Add context" picker:

```
URI:        schema://database
mimeType:   text/markdown
annotations:
  audience: ["user"]
  priority: 0.5
```

No `reference://surahs` or `reference://juz-pages` resources — they would
be redundant with the tools and Claude.ai users would not attach them
manually.

The schema markdown content is generated by `pnpm mcp:gen-schema` from
`schema.sql` plus inline annotations in `scripts/gen-schema.ts`. The
generated file is committed at `src/mcp/resources/schema.md` and reviewed
on every migration.

## Authentication

OAuth 2.1 via `@cloudflare/workers-oauth-provider`, with login UX based on
a magic link delivered through the existing Telegram bot. No password.

### Why magic link

Authentication is bound to possession of the authorised Telegram account
(`ALLOWED_USER_ID`). This reuses an existing trust chain — anyone able to
use the Telegram bot is by definition the owner of the data — and removes
the need to provision and rotate a password.

### Flow

1. User adds the custom MCP connector in Claude.ai pointing at the worker.
2. Claude.ai initiates OAuth → redirect to `GET /oauth/authorize?...`.
3. **Page 1 (request)**: a single button "Send code via Telegram". No
   username, no password.
4. Click → `POST /oauth/login/request`:
   - Generate a 6-digit code via `crypto.getRandomValues` modulo 1_000_000,
     zero-padded.
   - Create a login session in `OAUTH_KV` under
     `login:<session_id>` with TTL 5 minutes.
   - Send the code via `bot.api.sendMessage(ALLOWED_USER_ID, ...)`.
   - Render Page 2 with `session_id` in a hidden form field, signed with
     `MCP_SESSION_HMAC_SECRET`.
5. **Page 2 (verify)**: 6-digit input + signed `session_id` hidden field.
6. Submit → `POST /oauth/login/verify`:
   - Verify the HMAC on `session_id`.
   - Lookup the KV record. If missing/expired → `errorExpired`.
   - Compare `sha256(submittedCode + pepper)` to the stored hash.
   - On match: invalidate the session (anti-replay), delegate to
     `OAuthProvider.completeAuthorization()`, redirect to Claude.ai.
   - On mismatch: increment `attempts`. After 3 failed attempts the
     session is invalidated.
7. Claude.ai exchanges the auth code at `POST /oauth/token` for access +
   refresh tokens. Subsequent reconnects are transparent until the
   refresh token expires.

### Login session record (KV)

Key: `login:<session_id>` (32 bytes, base64url, 5-minute TTL).

```json
{
  "oauthRequestId": "...",
  "codeHash": "sha256(code + pepper)",
  "attempts": 0,
  "createdAt": 1714325000
}
```

Pepper is `MCP_SESSION_HMAC_SECRET` reused. The hash is stored, not the
clear-text code.

### Guardrails

- TTL 5 minutes on the code (KV expiry).
- Max 3 verification attempts per session.
- Code consumed (session invalidated) on first successful verify.
- Rate limit: max 3 codes per IP per 10 minutes, tracked in KV under
  `login_rate:<ip>`.
- CSRF: `session_id` is HMAC-signed and lives in a hidden form field, not
  the URL. No cookies.
- Code generation uses `crypto.getRandomValues`, modulo 1M zero-padded.
  Brute-force across 3 attempts and 5 minutes is statistically negligible.

### Endpoints

| Path | Source | Role |
|---|---|---|
| `GET /.well-known/oauth-authorization-server` | library (auto) | OAuth metadata |
| `POST /oauth/register` | library (auto) | Dynamic client registration |
| `GET /oauth/authorize` | this design | Renders page 1 |
| `POST /oauth/login/request` | this design | Generates code, sends Telegram, renders page 2 |
| `POST /oauth/login/verify` | this design | Validates code, completes OAuth |
| `POST /oauth/token` | library (auto) | Code → tokens |
| `POST /oauth/revoke` | library (auto) | Revocation |
| `GET/POST /mcp/sse` and `/mcp/message` | this design | MCP transport, OAuth-protected |

### Scopes

A single scope: `mcp:read`. All tools are read-only by construction; no
granularity needed for a single-user setup.

### Token lifetimes

- Access token: 1 hour.
- Refresh token: 30 days.

The Claude app refreshes transparently; the user re-authenticates via
Telegram code roughly every 30 days of inactivity.

### Failure mode

If the Telegram `BOT_TOKEN` is revoked or the bot is offline, login is
not possible. The single user is also the bot operator and will notice
immediately. There is intentionally no password fallback — adding one
would defeat the simplicity of the model. Emergency access is possible
via `wrangler tail` to read codes from logs (or a temporary fallback in
a hotfix commit).

## Localisation

The login pages and the Telegram code message are localised through the
existing `src/locales/{en,fr,ar}.ts` infrastructure, driven by the bot's
configured locale (`getLocale(env)`).

Tool and resource payloads are **not** localised: they return raw English
data (e.g. surah transliterations, ISO timestamps, numbers in seconds) so
the LLM can phrase the final answer in the conversation's language.

### New locale keys

In `src/locales/types.ts` and implemented in `en.ts`, `fr.ts`, `ar.ts`:

```ts
mcpLogin: {
  pageTitle: string;
  heading: string;
  intro: string;
  sendCodeButton: string;
  codeInputLabel: string;
  verifyButton: string;
  codeSentNotice: string;
  errorWrongCode: string;       // "{remaining} attempts left"
  errorExpired: string;
  errorRateLimited: string;     // "{minutes}"
  errorTelegramSend: string;
};

mcpTelegramCode: string;        // "{code}"
```

Two new meta-keys are added to the `Locale` type to render correct HTML:

```ts
lang: string;   // "en" | "fr" | "ar"
dir: string;    // "ltr" | "rtl"
```

The Arabic page sets `<html dir="rtl">`. The exhaustiveness test suite
already enforces that every locale implements every key.

## Errors

Tools throw `McpError`-typed exceptions with a short machine-readable
`code` and a humanly readable `message`. The MCP SDK serialises them as
JSON-RPC errors. Internal stack traces and PII never reach the response.

| Code | Meaning |
|---|---|
| `INVALID_PARAMS` | Parameter validation failed (mostly handled by Zod) |
| `SQL_NOT_SELECT` | `query_sql` received a non-SELECT statement |
| `SQL_FORBIDDEN_TABLE` | Access to `sqlite_*` |
| `SQL_FORBIDDEN_FUNCTION` | Function not in whitelist |
| `SQL_TIMEOUT` | Query exceeded 10s |
| `DB_ERROR` | Unexpected D1 failure (logged with context, message is generic) |

`truncated: true` is a flag on a successful `query_sql` response, not an
error.

## Tests

Vitest, mocking `D1Database` with `vi.fn()` per existing project pattern.

1. **`sql-validator.test.ts`** — table-driven, ~30 cases: valid SELECTs
   accepted; mutations rejected; `sqlite_master` rejected; unwhitelisted
   functions rejected; multi-statement rejected; LIMIT injection and
   clamping verified.
2. **`tools.test.ts`** — happy-path test per tool plus 1–2 error cases.
   Mock D1 returns fixed rows; assert serialised output.
3. **`auth-login.test.ts`** — code generation, hashing, comparison,
   expiry, max attempts, rate limit. The OAuth provider library itself is
   trusted upstream; only our `request` and `verify` handlers are tested.
4. **`schema-snapshot.test.ts`** — snapshot of the markdown produced by
   `pnpm mcp:gen-schema`. Detects accidental drift on schema changes.
5. Login page snapshots, three locales × two states = 6 snapshots.

End-to-end MCP transport (SSE) is not covered by automated tests in v1.
Manual validation from Claude.ai is sufficient given the single-user
scope.

## Open questions / future work

- **Magic link reliability** — if 30-day refresh becomes annoying or the
  Telegram path proves flaky, revisit with a password or device-binding
  fallback.
- **Prayer-time tool** — re-evaluate after a few weeks of usage. If
  questions like "when in the prayer cycle do I read most?" come up, add
  a `get_prayer_times(date_range)` tool.
- **Read-replica D1** — if Cloudflare ever ships read-only D1 bindings,
  swap the `DB_RO` alias from documentation to a real read-only binding.
- **Audit log** — capture each MCP tool invocation in a `mcp_audit` table
  (tool name, params, timestamp, duration). Out of scope for v1; consider
  if multi-device suspicion ever arises.
