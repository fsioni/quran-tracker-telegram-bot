# Plan de sprints -- Quran Reading Tracker

Ref : `docs/superpowers/specs/2026-03-13-quran-telegram-bot-design.md`

---

## Sprint 0 -- Scaffolding (prerequis de tout)

| Tache | Fichier(s) | Dependance |
|---|---|---|
| Init projet : `wrangler init`, tsconfig, package.json | racine | - |
| Installer deps : `grammy`, `vitest`, `miniflare`, `wrangler` | package.json | - |
| Config wrangler : D1 binding, cron trigger 5min | wrangler.toml | - |
| Schema D1 : sessions, config, prayer_cache | schema.sql | - |
| Entry point minimal : webhook + cron stub | src/index.ts | - |

**Livrable** : `wrangler dev` demarre sans erreur, D1 cree en local.

---

## Sprint 1 -- Domaine pur (zero I/O)

Tout ce sprint est **100% parallelisable** -- aucune dependance entre les taches.

```
  [surahs.ts + tests]     [quran.ts + tests]     [format.ts + tests]
         |                       |                        |
         +-- independant --+-- independant --+-- independant
```

### Agent A : Referentiel

| Tache | Fichier(s) |
|---|---|
| Tableau des 114 sourates (numero, nom arabe, nom FR, nb versets) | src/data/surahs.ts |

### Agent B : Validation coranique

| Tache | Fichier(s) |
|---|---|
| Validation sourate (1-114) | src/services/quran.ts |
| Validation verset dans les bornes | src/services/quran.ts |
| Validation ordre (meme sourate + cross-sourate) | src/services/quran.ts |
| Calcul ayah_count (meme sourate) | src/services/quran.ts |
| Calcul ayah_count (cross 2 sourates) | src/services/quran.ts |
| Calcul ayah_count (cross 3+ sourates) | src/services/quran.ts |
| Tests unitaires | tests/quran.test.ts |

### Agent C : Parsing et formatage

| Tache | Fichier(s) |
|---|---|
| Parse duree (8m53, 1h30m, etc.) | src/services/format.ts |
| Parse range session (2:77-83, 2:280-3:10) | src/services/format.ts |
| Parse ligne import (10/03, 13h30 - 8m53 - 2:77-83) | src/services/format.ts |
| Formatage duree secondes -> texte | src/services/format.ts |
| Formatage messages (stats, progress, history, rappel) | src/services/format.ts |
| Tests unitaires | tests/format.test.ts |

**Livrable** : `vitest run` passe, domaine metier couvert a 100%.

---

## Sprint 2 -- Couche donnees + squelette bot

Depend de : Sprint 0 (D1 dispo) + Sprint 1 (types/validation).

```
  [db.ts + tests]  <-->  [bot.ts + /start + /help]
       |                          |
       +--- partiellement parallelisable ---+
       (db.ts n'a pas besoin du bot, le bot a besoin de db pour /start)
```

### Agent A : Service DB

| Tache | Fichier(s) |
|---|---|
| Insert session | src/services/db.ts |
| Get session by ID | src/services/db.ts |
| Get derniere session | src/services/db.ts |
| Delete session by ID | src/services/db.ts |
| Insert batch (import) | src/services/db.ts |
| Stats globales (SUM ayah_count, SUM duration, AVG) | src/services/db.ts |
| Stats par periode (semaine, mois) | src/services/db.ts |
| Calcul streak (actuel + meilleur) | src/services/db.ts |
| Get/set config | src/services/db.ts |
| CRUD prayer_cache | src/services/db.ts |
| Tests integration avec miniflare | tests/db.test.ts |

### Agent B : Squelette bot

| Tache | Fichier(s) |
|---|---|
| Config grammY + webhookCallback cloudflare-mod | src/bot.ts |
| Wiring webhook + cron dans index.ts | src/index.ts |
| Handler /start (enregistre chat_id) | src/handlers/config.ts |
| Handler /help | src/handlers/config.ts |
| Tests handlers /start, /help | tests/handlers/config.test.ts |

**Livrable** : bot repond a /start et /help, DB fonctionnelle.

---

## Sprint 3 -- Commandes de session

Depend de : Sprint 2.

```
  [/session + tests]     [/import + tests]     [/history + tests]     [/undo + /delete + tests]
         |                      |                      |                        |
         +---- parallelisable (tous dependent de db.ts et format.ts) ----+
```

**4 taches parallelisables** -- chaque handler est independant des autres.

### Agent A : /session

| Tache | Fichier(s) |
|---|---|
| Parse arguments, validation, insert | src/handlers/session.ts |
| Message de confirmation avec noms de sourates | src/handlers/session.ts |
| Tests (cas normaux + erreurs de saisie) | tests/handlers/session.test.ts |

### Agent B : /import

| Tache | Fichier(s) |
|---|---|
| Parse multi-lignes, deduction annee | src/handlers/import.ts |
| Validation batch, rapport d'erreurs | src/handlers/import.ts |
| Tests (import valide, lignes en erreur, mix) | tests/handlers/import.test.ts |

### Agent C : /history

| Tache | Fichier(s) |
|---|---|
| Query 10 dernieres sessions, formatage | src/handlers/stats.ts |
| Tests | tests/handlers/stats.test.ts |

### Agent D : /undo + /delete

| Tache | Fichier(s) |
|---|---|
| /undo : affiche derniere session + InlineKeyboard | src/handlers/manage.ts |
| /delete ID : affiche session + InlineKeyboard | src/handlers/manage.ts |
| Callback handler pour confirmation/annulation | src/handlers/manage.ts |
| Tests (confirm, annul, timeout, session inexistante) | tests/handlers/manage.test.ts |

**Livrable** : toutes les commandes CRUD de session fonctionnelles.

---

## Sprint 4 -- Stats et progression

Depend de : Sprint 2 (db.ts) + Sprint 3 (donnees en DB pour tester).

```
  [/stats + tests]     [/progress + tests]
         |                      |
         +-- parallelisable --+
```

### Agent A : /stats

| Tache | Fichier(s) |
|---|---|
| Stats globales (versets, duree, vitesse, streak) | src/handlers/stats.ts |
| Stats par periode (semaine, mois) | src/handlers/stats.ts |
| Tests | tests/handlers/stats.test.ts |

### Agent B : /progress

| Tache | Fichier(s) |
|---|---|
| % global, barre visuelle, dernier point | src/handlers/stats.ts |
| Tests | tests/handlers/stats.test.ts |

**Livrable** : `vitest run` passe, /stats et /progress operationnels.

---

## Sprint 5 -- Rappels aux heures de priere

Depend de : Sprint 2 (db.ts pour prayer_cache + config).

```
  [prayer.ts + tests]  -->  [cron handler]  -->  [/config city/country/tz]
                                                         |
                                            (parallelisable avec cron si db.ts pret)
```

### Agent A : Service priere

| Tache | Fichier(s) |
|---|---|
| Fetch API Aladhan, parse reponse | src/services/prayer.ts |
| Cache dans prayer_cache via db.ts | src/services/prayer.ts |
| Logique "est-ce l'heure d'un rappel" (fenetre 10-14min) | src/services/prayer.ts |
| Gestion fuseau horaire | src/services/prayer.ts |
| Tests unitaires (parse, detection, timezone) | tests/prayer.test.ts |

### Agent B : Cron handler + /config

| Tache | Fichier(s) |
|---|---|
| Cron handler dans index.ts (scheduled event) | src/index.ts |
| Composition du message de rappel | src/index.ts |
| /config (affichage + sous-commandes city/country/tz) | src/handlers/config.ts |
| Tests /config | tests/handlers/config.test.ts |

**Livrable** : rappels envoyes aux heures de priere, config modifiable.

---

## Sprint 6 -- Integration, polish, deploy

Depend de : tous les sprints precedents.

| Tache | Fichier(s) | Parallelisable |
|---|---|---|
| Test E2E manuel : toutes les commandes via Telegram | - | non |
| Nettoyage prayer_cache > 7 jours | src/services/db.ts | oui |
| .env.example avec BOT_TOKEN | .env.example | oui |
| README : setup, commandes, deploy | README.md | oui |
| Deploy sur CF Workers (wrangler deploy) | - | non (apres tests) |
| Test en prod | - | non (apres deploy) |

**Livrable** : bot en production sur Cloudflare Workers.

---

## Resume parallelisme

```
Sprint 0  [=========]  1 agent
               |
Sprint 1  [A] [B] [C]  3 agents en parallele
               |
Sprint 2  [A] [B]      2 agents en parallele
               |
Sprint 3  [A][B][C][D]  4 agents en parallele
               |
Sprint 4  [A] [B]      2 agents en parallele
               |
Sprint 5  [A] [B]      2 agents en parallele
               |
Sprint 6  [=========]  1 agent (sequentiel)
```

**Capacite max de parallelisme : 4 agents (Sprint 3).**

Les sprints 4 et 5 sont independants l'un de l'autre et pourraient tourner en parallele aussi (tous deux dependent de Sprint 2, pas l'un de l'autre), ce qui donnerait :

```
Sprint 2  [A] [B]
               |
         Sprint 3  [A][B][C][D]
               |
    Sprint 4  [A][B]  +  Sprint 5  [A][B]   <-- 4 agents en parallele
               |
         Sprint 6
```
