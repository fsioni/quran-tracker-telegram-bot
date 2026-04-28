# Quran Telegram Bot

A Telegram bot for tracking Quran reading sessions with automatic prayer time reminders, deployed on Cloudflare Workers with D1 (SQLite).

[![CI](https://github.com/fsioni/quran-tracker-telegram-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/fsioni/quran-tracker-telegram-bot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)

## Features

- Session tracking with full Quran range validation (surah:ayah)
- Live reading timer with start/stop controls
- Automatic prayer time reminders via the Aladhan API
- Reading stats: speed analytics, streaks, and weekly recap
- Progress tracking through the entire Quran
- Bulk import of past sessions
- Multi-language support (English, French, Arabic)
- Khatma (full Quran completion) tracking
- Conversational data analysis: connect Claude to your reading data via the built-in MCP server (see [docs/MCP.md](docs/MCP.md))

## Commands

| Command | Description |
|---|---|
| `/start` | Start the bot |
| `/help` | Show help |
| `/session <range> <duration>` | Log a reading session (e.g. `/session 2:77-83 8m53`) |
| `/go` | Start a reading timer |
| `/stop` | Stop the timer |
| `/read` | Read the next page |
| `/extra` | Log an extra reading |
| `/kahf` | Read Surah Al-Kahf (Fridays) |
| `/import` | Bulk import sessions |
| `/history` | View session history |
| `/stats` | Reading statistics |
| `/progress` | Quran completion progress |
| `/speed` | Reading speed analytics |
| `/graph` | Reading charts (speed & pages/day) |
| `/undo` | Undo the last session |
| `/edit <id> <duration>` | Edit a session duration |
| `/delete <id>` | Delete a session by ID |
| `/config [key] [value]` | Configure city, country, timezone, language |
| `/prayer` | Refresh prayer times |

## Prerequisites

- Node.js >= 18
- [pnpm](https://pnpm.io/)
- A [Cloudflare](https://dash.cloudflare.com/sign-up) account
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Quick Start

```bash
git clone https://github.com/fsioni/quran-tracker-telegram-bot.git
cd quran-tracker-telegram-bot
pnpm install

# Create D1 database
wrangler d1 create quran-tracker
# Copy the returned database_id into wrangler.toml

# Apply schema
wrangler d1 execute quran-tracker --local --file=schema.sql

# Configure environment
cp .env.example .dev.vars
# Fill in BOT_TOKEN and ALLOWED_USER_ID in .dev.vars

# Start dev server
pnpm dev
```

## Deployment

### 1. Create and configure the D1 database

```bash
wrangler d1 create quran-tracker
# Copy the returned database_id into wrangler.toml

wrangler d1 execute quran-tracker --remote --file=schema.sql
```

### 2. Provision the OAuth KV namespace (for the MCP server)

```bash
wrangler kv namespace create OAUTH_KV
# Save the returned id; it's needed as the OAUTH_KV_NAMESPACE_ID GitHub secret below
```

### 3. Set secrets

```bash
wrangler secret put BOT_TOKEN
wrangler secret put ALLOWED_USER_ID
# 32 random bytes for signing MCP login sessions
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" \
  | wrangler secret put MCP_SESSION_HMAC_SECRET
```

### 4. Deploy

```bash
wrangler deploy
```

### 5. Register the webhook

Point Telegram to your Worker URL:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>"
```

Replace `<BOT_TOKEN>` with your bot token and `<WORKER_URL>` with the deployed Worker URL.

### 6. Register bot commands

```bash
curl -X POST <WORKER_URL>/setup -H "Authorization: Bearer <BOT_TOKEN>"
```

This registers the command menu in Telegram. Run it once after deploying, or again after adding new commands.

The cron trigger (`*/5 * * * *`) handles prayer time reminders automatically.

### 7. (Optional) Connect the MCP server to Claude

Add a custom connector in Claude pointing at `https://<WORKER_URL>/mcp/sse`. See [docs/MCP.md](docs/MCP.md) for the full flow and the list of tools exposed.

### CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs tests on every PR and deploys to Cloudflare on push to `main`.

Required GitHub repository secrets:

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `D1_DATABASE_ID` | The D1 database UUID (from `wrangler d1 create`) |
| `OAUTH_KV_NAMESPACE_ID` | The KV namespace id (from `wrangler kv namespace create OAUTH_KV`) |
| `BOT_TOKEN` | Telegram bot token (used to register commands post-deploy) |

## Configuration

Use `/config` to set your location for prayer time reminders:

```
/config city Mecca
/config country SA
/config timezone Asia/Riyadh
/config language fr
```

Available languages: `en` (English, default), `fr` (French), `ar` (Arabic).

Defaults to Mecca, Saudi Arabia (`Asia/Riyadh`) if not configured.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Bot Framework | grammY |
| MCP | [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk), [@cloudflare/workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider) |
| Language | TypeScript |
| Tests | Vitest |

## License

[MIT](LICENSE)
