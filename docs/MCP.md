# MCP Server — Chat with your reading data

The bot exposes a remote, **read-only** MCP (Model Context Protocol) server so you can have ad-hoc conversations about your reading history from the Claude app (web, desktop, or mobile).

The MCP layer never writes — adding sessions, editing, or deleting still happens through the Telegram bot. Tools are SELECT-only by construction; a parser-based validator rejects any non-SELECT statement before it reaches D1.

## What you can ask

Once connected, just talk to Claude in natural language. Some examples:

- "What's my current streak?"
- "How many sessions did I do this month vs last month?"
- "Which surah do I read most often?"
- "Find my habits: when do I drop off, what days am I most consistent?"
- "Summarise my last khatma: total time, pace, surahs that took longest."
- "If I want to finish a khatma before Ramadan, what pace given my history?"
- "Show me sessions grouped by prayer time slot."

For ad-hoc questions outside the curated tools, Claude writes SQL via the `query_sql` escape hatch. It's parser-validated, SELECT-only, capped at 1000 rows, with a 10-second timeout.

## Connect from the Claude app

1. Open **Claude → Settings → Connectors → Add custom connector**.
2. URL: `https://<your-worker>.workers.dev/mcp/sse`.
3. Claude will redirect you to the worker's login page.
4. Click **Send code via Telegram**. You'll receive a 6-digit code from the bot.
5. Enter the code. The connector switches to "Connected".

Login binds to your Telegram account (via `ALLOWED_USER_ID`) — anyone able to use the bot is the owner of the data, so no separate password is needed. The code is valid for 5 minutes, max 3 attempts. Rate-limit: 3 codes per IP per 10 minutes.

Token lifetimes: access token 1 hour, refresh token 30 days. Claude refreshes transparently; you re-authenticate every ~30 days of inactivity.

## Tools exposed

| Tool | Purpose |
|---|---|
| `get_global_stats` | All-time totals (sessions, ayahs, pages, time), optionally filtered by `type` |
| `get_period_stats` | Aggregates for a week or month, with optional `offset` (0 = current, 1 = previous, ...) |
| `get_streak` | Current and best consecutive-day streaks |
| `get_khatmas` | List of completed khatmas (full Quran reads) |
| `get_recent_speed` | Reading speed (seconds/page, pages/day) over the last N days |
| `get_sessions` | Sessions in a date range with optional type filter, capped at 200 rows |
| `get_config` | City, country, timezone, today's date |
| `get_surahs` | Surah metadata: id, transliterated name, Arabic name, ayah count |
| `get_juz_pages` | Juz to page-range mapping (Madinah Mushaf, 604 pages) |
| `get_schema` | Full database schema documentation in markdown |
| `query_sql` | Read-only SELECT escape hatch — the LLM writes SQL when no curated tool fits |

One MCP resource is also available: `schema://database` (markdown), attachable from Claude's "+ Add context" picker if you want to manually paste the schema in a conversation.

## Security model

- **Single-user**: the OAuth provider issues tokens against `ALLOWED_USER_ID`. There is no user table; the userId is the same constant the Telegram bot enforces.
- **Read-only**: every tool wraps existing read-side functions, plus `query_sql` validated by an AST parser that rejects all mutations (`INSERT`/`UPDATE`/`DELETE`/`DROP`/`PRAGMA`/`ATTACH`/transactions/multi-statement). Internal tables (`sqlite_master` etc.) are blocked.
- **OAuth 2.1 with PKCE**, dynamic client registration, KV-backed token store. Access tokens, refresh tokens, and authorization codes are stored as hashes; `props` is encrypted with the token as key material.
- **Magic link** is bound to your Telegram bot. If the `BOT_TOKEN` is revoked, login is impossible — recover by re-issuing the bot token in @BotFather and redeploying.
- **No production write path** is wired through MCP. Any data corruption you cause via Claude is your own SQL — but it can't happen because nothing the MCP exposes can write.

## Localisation

The login pages and the Telegram code message follow the bot's configured locale (`/config language en|fr|ar`). Arabic uses `dir="rtl"`. Tool responses themselves are raw English data (numbers, ISO dates, transliterated surah names) — Claude phrases the final answer in your conversation's language.

## Operations

### First-time setup

You need three one-shot operations on top of the regular bot deploy:

```bash
# 1. Provision the KV namespace (note the returned id)
wrangler kv namespace create OAUTH_KV

# 2. Set the HMAC secret on the worker
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" \
  | wrangler secret put MCP_SESSION_HMAC_SECRET

# 3. Add the KV id as a GitHub Actions secret
gh secret set OAUTH_KV_NAMESPACE_ID --body "<id from step 1>"
```

The CI substitutes `<OAUTH_KV_NAMESPACE_ID>` in `wrangler.toml` from the GitHub secret on each deploy.

### Verifying the deploy

```bash
# OAuth metadata should return JSON
curl https://<your-worker>.workers.dev/.well-known/oauth-authorization-server

# /mcp/sse without auth must return 401
curl -i https://<your-worker>.workers.dev/mcp/sse
```

### Rotating the HMAC secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" \
  | wrangler secret put MCP_SESSION_HMAC_SECRET
```

This invalidates any in-flight login sessions (5-minute TTL anyway) but does not revoke issued OAuth tokens. To force a full re-login, also clear the `OAUTH_KV` namespace.

## Architecture

```
Claude app ── OAuth dance ──► Worker /oauth/* ──► OAUTH_KV
Claude app ── MCP HTTP  ────► Worker /mcp/sse ──► tools ──► D1
                                              └─► resources ──► D1
Telegram   ── webhook ──────► Worker POST /  ──► existing handlers
```

A single Cloudflare Worker serves both flows. The `OAuthProvider` from `@cloudflare/workers-oauth-provider` is the worker entrypoint; it dispatches `/mcp/*` to the MCP server and everything else to the default handler (login pages, `/setup`, Telegram webhook). The cron trigger (`*/5 * * * *`) is preserved for prayer-time reminders.

## Source

- Spec: [docs/superpowers/specs/2026-04-28-mcp-data-chat-design.md](superpowers/specs/2026-04-28-mcp-data-chat-design.md)
- Implementation plan: [docs/superpowers/plans/2026-04-28-mcp-data-chat.md](superpowers/plans/2026-04-28-mcp-data-chat.md)
- Code: `src/mcp/`
