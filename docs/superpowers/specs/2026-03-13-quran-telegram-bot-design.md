# Quran Reading Tracker -- Telegram Bot

## Overview

Bot Telegram mono-utilisateur pour tracker la lecture du Coran. Enregistre les sessions de lecture (sourate, versets, duree), affiche des stats, et envoie des rappels aux heures de priere.

## Stack

| Composant | Choix |
|---|---|
| Langage | TypeScript |
| Framework bot | grammY (webhook mode, adaptateur `cloudflare-mod`) |
| Hosting | Cloudflare Workers |
| Base de donnees | Cloudflare D1 (SQLite manage) |
| Tests | Vitest + miniflare |
| API externe | Aladhan (horaires de priere) |

## Contraintes

- Mono-utilisateur (pas de table users, chat_id dans config)
- Bot en francais
- Lecture en arabe uniquement (pas de traduction)
- Pas de khatma (cycle complet), suivi lineaire
- Slash commands uniquement (pas de texte libre)
- Pas de visuels/graphiques en v1
- Deploiement : local pour dev, Cloudflare Workers pour prod

## Architecture

```
Cloudflare Worker (webhook)
    |
    +-- grammY Bot (webhook mode)
    |       |
    |       +-- /start, /help, /session, /import
    |       +-- /stats, /progress, /history
    |       +-- /undo, /delete, /config
    |
    +-- D1 Database (SQLite)
    |       |
    |       +-- sessions
    |       +-- config
    |       +-- prayer_cache
    |
    +-- Cron Trigger (toutes les 5 minutes)
            |
            +-- Verifie prayer_cache pour aujourd'hui
            +-- Si heure actuelle = priere + 10min (tolerance 5min) --> rappel
            +-- Si pas de cache --> fetch Aladhan, stocke dans prayer_cache
```

## Structure des fichiers

```
src/
  index.ts          -- entry point, webhook + cron handler
  bot.ts            -- config grammY, registration des commandes
  handlers/
    session.ts      -- /session
    import.ts       -- /import
    stats.ts        -- /stats, /progress, /history
    manage.ts       -- /undo, /delete
    config.ts       -- /config, /start
  services/
    db.ts           -- queries D1
    quran.ts        -- referentiel 114 sourates, validation versets
    prayer.ts       -- API Aladhan + logique rappels
    format.ts       -- formatage des messages FR, parsing des inputs
  data/
    surahs.ts       -- const array des 114 sourates
tests/
  quran.test.ts
  format.test.ts
  prayer.test.ts
  db.test.ts
  handlers/
    session.test.ts
    import.test.ts
    stats.test.ts
    manage.test.ts
wrangler.toml       -- config CF Worker + D1 + cron
```

## Modele de donnees

### Table `sessions`

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  surah_start INTEGER NOT NULL,
  ayah_start INTEGER NOT NULL,
  surah_end INTEGER NOT NULL,
  ayah_end INTEGER NOT NULL,
  ayah_count INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

- `started_at` : ISO 8601 (date + heure de la session)
- `duration_seconds` : duree en secondes
- `ayah_count` : nombre de versets, pre-calcule a l'insertion
- Pour une session cross-sourate `2:280-3:10` : `(286 - 280 + 1) + 10 = 17`

Index :
```sql
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
```

### Table `config`

```sql
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Valeurs initiales :
- `chat_id` : rempli au premier `/start`
- `city` : `Playa del Carmen`
- `country` : `MX`
- `timezone` : `America/Cancun`

### Table `prayer_cache`

```sql
CREATE TABLE prayer_cache (
  date TEXT PRIMARY KEY,
  fajr TEXT NOT NULL,
  dhuhr TEXT NOT NULL,
  asr TEXT NOT NULL,
  maghrib TEXT NOT NULL,
  isha TEXT NOT NULL,
  fajr_sent INTEGER DEFAULT 0,
  dhuhr_sent INTEGER DEFAULT 0,
  asr_sent INTEGER DEFAULT 0,
  maghrib_sent INTEGER DEFAULT 0,
  isha_sent INTEGER DEFAULT 0,
  fetched_at TEXT DEFAULT (datetime('now'))
);
```

Cache journalier des horaires de priere. Un seul fetch Aladhan par jour. Les colonnes `*_sent` trackent les rappels deja envoyes (0 = non, 1 = oui). Reset naturel : nouvelle ligne chaque jour. Les entrees de plus de 7 jours sont supprimees au moment du fetch quotidien.

## Referentiel coranique

### `data/surahs.ts`

Tableau constant des 114 sourates :

```ts
type Surah = {
  number: number;    // 1-114
  nameAr: string;    // nom arabe
  nameFr: string;    // nom francais/translittere
  ayahCount: number; // nombre de versets
};
```

Total : 6236 versets.

### Validation

1. Sourate existe : `number` entre 1 et 114
2. Verset dans les bornes : `ayah_start >= 1` et `ayah_end <= surah.ayahCount`
3. Ordre coherent : si meme sourate `ayah_start <= ayah_end`, si cross-sourate `surah_start < surah_end`
4. Cross-sourate : chaque borne validee dans sa sourate respective

### Calcul `ayah_count`

Meme sourate `2:77-83` : `83 - 77 + 1 = 7`

Cross-sourate `2:280-3:10` :
- Sourate 2 : `286 - 280 + 1 = 7`
- Sourate 3 : `10`
- Total : `17`

Cross 3+ sourates `2:280-4:5` :
- Sourate 2 : `286 - 280 + 1 = 7`
- Sourate 3 : `200` (complete)
- Sourate 4 : `5`
- Total : `212`

## Commandes

### `/start`

Premier contact. Enregistre le `chat_id` dans config. Message de bienvenue avec liste des commandes.

### `/help`

Affiche la liste des commandes disponibles avec une description courte de chacune. Meme contenu que le message de bienvenue de `/start`, sans re-enregistrer le `chat_id`.

### `/session 2:280-3:10 8m53`

Grammaire de la commande :

```
/session RANGE DURATION
RANGE    := SURAH:AYAH-AYAH           (meme sourate)
          | SURAH:AYAH-SURAH:AYAH     (cross-sourate)
SURAH    := 1..114
AYAH     := 1..ayahCount(SURAH)
DURATION := [Hh]Mm[SS]               (ex: 8m53, 8m, 1h30m, 1h8m53)
```

1. Parse les arguments selon la grammaire ci-dessus
2. Format simple (meme sourate) : `/session 2:77-83 8m53`
3. Format cross-sourate : `/session 2:280-3:10 8m53`
4. Valide sourates et versets via le referentiel
5. Calcule `ayah_count`
6. `started_at` = date/heure courante
7. Insere en DB
8. Reponse : "Session enregistree : sourate Al-Baqara v.280 a sourate Al-Imran v.10 -- 17 versets en 8m53"

Formats de duree acceptes : `8m53`, `8m`, `1h30m`, `1h8m53`

### `/import`

Commande en une seule fois : les donnees sont dans le meme message que `/import`.

```
/import
10/03, 13h30 - 8m53 - 2:77-83
09/03, 20h15 - 12m10 - 2:60-76
08/03, 14h00 - 15m - 1:1-2:10
```

Telegram permet des messages multi-lignes, donc l'utilisateur colle tout d'un bloc apres `/import`.

Format attendu par ligne : `JJ/MM, HHhMM - DUREE - RANGE` (RANGE suit la meme grammaire que `/session`).

L'annee est deduite : si la date est dans le futur, on prend l'annee precedente.

Parse, valide, insere en batch. Reponse : "X sessions importees, Y erreurs" avec detail des erreurs (ligne + raison).

Pas d'etat entre messages -- tout est traite dans une seule requete.

### `/stats`

```
-- Stats globales --
Versets lus : 342
Duree totale : 4h23m
Vitesse moyenne : 78 versets/heure
Streak actuel : 5 jours
Meilleur streak : 12 jours

-- Cette semaine --
Versets : 45 | Duree : 38m
-- Ce mois --
Versets : 187 | Duree : 2h15m
```

#### Definition du streak

- Un "jour" est defini dans le fuseau horaire configure (`timezone` dans config, defaut `America/Cancun`)
- Un jour compte comme "lu" s'il existe au moins une session dont `started_at` tombe dans ce jour
- Le streak actuel = nombre de jours consecutifs jusqu'a aujourd'hui (inclus si session aujourd'hui, sinon jusqu'a hier)
- Le meilleur streak est calcule a la volee en scannant toutes les sessions (pas de cache -- volume faible pour mono-user)
- Plusieurs sessions le meme jour comptent comme un seul jour

### `/progress`

```
Progression : 342 / 6236 versets (5.5%)
[##-----------------] 5.5%
Dernier point : sourate Al-Imran (3), verset 10
```

"Dernier point" = `surah_end:ayah_end` de la session la plus recente (par `started_at`). Ce n'est pas le point le plus avance jamais atteint, mais le dernier point lu chronologiquement. Comme la lecture n'est pas strictement sequentielle (mix des deux), ce choix est le plus coherent.

### `/history`

10 dernieres sessions :

```
#42 | 10/03 13h30 | 8m53 | Al-Baqara 2:77-83 (7v)
#41 | 09/03 20h15 | 12m10 | Al-Baqara 2:60-76 (17v)
...
```

### `/undo`

Supprime la derniere session. Demande confirmation via callback button inline (grammY `InlineKeyboard`). Le bot affiche :

```
Supprimer la session #42 (Al-Baqara 2:77-83) ?
[Confirmer] [Annuler]
```

Le callback contient l'ID de la session. Pas d'etat a maintenir : l'ID est encode dans le callback_data. Si l'utilisateur ne clique pas, rien ne se passe. Timeout implicite : les boutons inline restent cliquables mais le bot peut ignorer les callbacks vieux de plus de 5 minutes.

### `/delete 42`

Supprime la session par ID. Meme confirmation via callback button inline (meme pattern que `/undo`).

### `/config`

Affiche la config actuelle. Sous-commandes separees pour chaque parametre :
- `/config city Playa del Carmen` -- change la ville (texte libre, peut contenir des espaces)
- `/config country MX` -- change le code pays (2 lettres ISO)
- `/config timezone America/Cancun` -- change le fuseau horaire

### Messages d'erreur

Format uniforme pour toutes les erreurs :

```
Erreur : [description du probleme]
Exemple : /session 2:77-83 8m53
```

Exemples :
- Sourate invalide : "Erreur : la sourate 0 n'existe pas (1-114)"
- Verset hors bornes : "Erreur : la sourate Al-Baqara n'a que 286 versets (verset 300 demande)"
- Format de duree invalide : "Erreur : format de duree invalide '8min'. Utilise 8m ou 8m53"
- Format de session invalide : "Erreur : format invalide. Utilise /session 2:77-83 8m53"
- Session inexistante (delete) : "Erreur : la session #99 n'existe pas"

## Rappels

### Logique

- Cron Trigger toutes les 5 minutes
- A chaque execution :
  1. Verifie si `prayer_cache` a une entree pour aujourd'hui
  2. Si non, fetch Aladhan API `/v1/timingsByCity/{DD-MM-YYYY}?city={city}&country={country}&method=2`
  3. Pour chaque priere, verifie si `maintenant` est dans la fenetre `[priere + 10min, priere + 14min]`
  4. Verifie le flag `*_sent` correspondant dans `prayer_cache`
  5. Si oui et flag = 0, envoie le rappel et met le flag a 1

### Anti-doublon

Colonnes dans `prayer_cache` pour tracker les rappels envoyes :

```sql
ALTER TABLE prayer_cache ADD COLUMN fajr_sent INTEGER DEFAULT 0;
ALTER TABLE prayer_cache ADD COLUMN dhuhr_sent INTEGER DEFAULT 0;
ALTER TABLE prayer_cache ADD COLUMN asr_sent INTEGER DEFAULT 0;
ALTER TABLE prayer_cache ADD COLUMN maghrib_sent INTEGER DEFAULT 0;
ALTER TABLE prayer_cache ADD COLUMN isha_sent INTEGER DEFAULT 0;
```

Chaque flag passe a 1 quand le rappel est envoye. Reset naturel : nouvelle ligne chaque jour.

### Contenu du rappel

```
Rappel de lecture

Derniere session : Al-Baqara 2:77-83 (hier, 20h15)
Cette semaine : 45 versets | 38m
Streak : 5 jours -- ne le casse pas !
```

### API Aladhan

- Endpoint : `/v1/timingsByCity/{DD-MM-YYYY}?city={city}&country={country}&method=2`
- `{DD-MM-YYYY}` : date du jour au format Aladhan
- Method 2 = Islamic Society of North America
- Si l'API echoue, on skip le rappel (pas de retry agressif)

## Strategie de tests

### Framework : Vitest + miniflare

### Tests unitaires

**`quran.test.ts`** -- `services/quran.ts`
- Validation sourate existante / inexistante (0, 115, -1)
- Validation verset dans les bornes / hors bornes
- Calcul `ayah_count` meme sourate
- Calcul `ayah_count` cross-sourate (2 sourates)
- Calcul `ayah_count` cross-sourate (3+ sourates)
- Ordre incoherent (sourate_fin < sourate_debut)

**`format.test.ts`** -- `services/format.ts`
- Parse duree : `8m53`, `8m`, `1h30m`, `1h8m53`
- Parse format session : `2:77-83`, `2:280-3:10`
- Parse format import : `10/03, 13h30 - 8m53 - 2:77-83`
- Formatage duree secondes -> texte (`5330s` -> `1h28m50`)
- Formatage messages stats, progress, history

**`prayer.test.ts`** -- `services/prayer.ts`
- Parse reponse API Aladhan
- Detection "est-ce l'heure d'un rappel" avec tolerance 5min
- Gestion fuseau horaire

### Tests d'integration

**`db.test.ts`** -- `services/db.ts` (avec miniflare / D1 en memoire)
- Insert session + lecture
- Calcul stats globales (SUM, AVG)
- Calcul stats par periode (semaine, mois)
- Calcul streak (jours consecutifs)
- Delete session par ID
- Delete derniere session (undo)
- Import batch

### Tests de handlers

**`handlers/*.test.ts`** -- chaque handler avec contexte grammY mocke
- Cas normaux : commande valide, reponse attendue
- Cas d'erreur : format invalide, sourate inexistante, verset hors bornes

### Scripts npm

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```
