# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Quran Tracker Telegram Bot — single-user bot for tracking Quran reading sessions with automatic prayer time reminders. Runs on Cloudflare Workers with D1 (SQLite) and uses grammY as the bot framework.

## Commands

```bash
pnpm dev            # Local dev server (wrangler)
pnpm test           # Run vitest once
pnpm test:watch     # Vitest in watch mode
pnpm test -- -u     # Update vitest snapshots
pnpm deploy         # Deploy to Cloudflare Workers
pnpm check          # Biome lint + format (auto-fix)
pnpm lint           # Biome lint only
pnpm format         # Biome format only
```

## Testing

- Vitest with snapshot tests for formatting and locale strings
- Locale tests enforce key exhaustiveness: every locale must implement every key from the `Locale` type
- Mock D1Database with `vi.fn()` in DB tests
- Run `pnpm test -- -u` after intentionally changing formatted output or locale strings

## Code Patterns

- **Result\<T\>** type (`src/types.ts`) for error handling — return `{ ok, value/error }` instead of throwing
- **Locales** in `src/locales/` — type-safe translations with exhaustiveness checks. When adding a string, add the key to `src/locales/types.ts` then implement in all locale files (en, fr, ar)
- **Single-user auth** — all requests checked against `ALLOWED_USER_ID` env var
- **Cron trigger** — `*/5 * * * *` checks prayer times via Aladhan API

## Database

- Schema in `schema.sql`, migrations in `migrations/`
- Apply locally: `wrangler d1 execute quran-tracker --local --file=schema.sql`

## Commits

- Imperative mood, concise: "Add /speed command", "Fix streak calculation"
- Never add Co-Authored-By lines
