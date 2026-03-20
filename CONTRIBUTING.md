# Contributing

## Prerequisites

- Node.js >= 18
- [pnpm](https://pnpm.io/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## Local setup

```bash
git clone https://github.com/<your-fork>/quran-telegram-bot.git
cd quran-telegram-bot
pnpm install
wrangler d1 create quran-tracker
wrangler d1 execute quran-tracker --local --file=schema.sql
cp .env.example .dev.vars  # fill in BOT_TOKEN and ALLOWED_USER_ID
pnpm dev
```

## Running tests

```bash
pnpm test
pnpm test:watch
```

## Submitting changes

1. Fork the repository
2. Create a branch from `main`
3. Make your changes
4. Run `pnpm test` and make sure all tests pass
5. Open a pull request against `main`

## Commit convention

Use imperative mood, keep it concise.

- `Add /speed command`
- `Fix streak calculation`
- `Remove unused helper`
