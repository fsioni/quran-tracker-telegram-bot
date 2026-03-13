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

CREATE INDEX idx_sessions_started_at ON sessions(started_at);

CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO config (key, value) VALUES ('city', 'Playa del Carmen');
INSERT INTO config (key, value) VALUES ('country', 'MX');
INSERT INTO config (key, value) VALUES ('timezone', 'America/Cancun');

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
