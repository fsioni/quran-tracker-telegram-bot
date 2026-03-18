# Quran Telegram Bot

Bot Telegram personnel pour suivre ses sessions de lecture du Coran, avec rappels de priere automatiques. Deploye sur Cloudflare Workers avec D1 (SQLite).

## Stack technique

- **Runtime** : Cloudflare Workers
- **Base de donnees** : Cloudflare D1 (SQLite)
- **Framework bot** : grammY
- **Langage** : TypeScript
- **Tests** : Vitest

## Prerequis

- Node.js >= 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm i -g wrangler`)
- Un compte Cloudflare
- Un bot Telegram (cree via [@BotFather](https://t.me/BotFather))

## Installation locale

```bash
# Cloner et installer
git clone <repo-url>
cd quran-telegram-bot
npm install

# Creer la base D1 locale
wrangler d1 create quran-tracker
# Copier le database_id retourne dans wrangler.toml

# Appliquer le schema
wrangler d1 execute quran-tracker --local --file=schema.sql

# Configurer le token
cp .env.example .dev.vars
# Remplir BOT_TOKEN dans .dev.vars

# Lancer en dev
npm run dev
```

## Commandes du bot

| Commande | Description |
|---|---|
| `/start` | Demarrer le bot |
| `/help` | Afficher l'aide |
| `/session <range> <duree>` | Enregistrer une session (ex: `/session 2:77-83 8m53`) |
| `/go` | Demarrer un timer de lecture |
| `/stop` | Arreter le timer |
| `/read` | Lire la prochaine page |
| `/extra` | Enregistrer une lecture extra |
| `/kahf` | Lire sourate Al-Kahf (vendredi) |
| `/import` | Importer des sessions en lot |
| `/history` | Historique des sessions |
| `/stats` | Statistiques de lecture (global, semaine, mois, streak) |
| `/progress` | Progression dans le Coran |
| `/undo` | Annuler la derniere session |
| `/delete <id>` | Supprimer une session par ID |
| `/config [cle] [valeur]` | Configurer ville, pays, fuseau horaire |
| `/debug` | Afficher l'etat interne du bot |

## Deploiement sur Cloudflare Workers

```bash
# 1. Creer la base D1
wrangler d1 create quran-tracker
# Copier le UUID retourne dans wrangler.toml (champ database_id)

# 2. Appliquer le schema en remote
wrangler d1 execute quran-tracker --remote --file=schema.sql

# 3. Ajouter le token du bot comme secret
wrangler secret put BOT_TOKEN

# 4. Deployer
wrangler deploy
```

## Configuration post-deploiement

Apres le deploiement, deux etapes manuelles :

1. **Enregistrer le menu de commandes** (une seule fois, ou apres ajout de commandes) :

```bash
curl -X POST <WORKER_URL>/setup -H "Authorization: Bearer <BOT_TOKEN>"
```

2. **Configurer le webhook Telegram** pour que les messages arrivent au Worker :

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>
```

Remplacer `<BOT_TOKEN>` par le token du bot et `<WORKER_URL>` par l'URL du Worker deploye.

Le cron (`*/5 * * * *`) gere automatiquement les rappels de priere.
