-- Allow duration_seconds to be NULL (for sessions recorded without a timer).
-- SQLite cannot ALTER COLUMN to remove NOT NULL, so we recreate the table.

CREATE TABLE sessions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  duration_seconds INTEGER,
  page_start INTEGER,
  page_end INTEGER,
  surah_start INTEGER NOT NULL,
  ayah_start INTEGER NOT NULL,
  surah_end INTEGER NOT NULL,
  ayah_end INTEGER NOT NULL,
  ayah_count INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'normal',
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO sessions_new (id, started_at, duration_seconds, page_start, page_end,
                          surah_start, ayah_start, surah_end, ayah_end, ayah_count,
                          type, created_at)
  SELECT id, started_at, duration_seconds, page_start, page_end,
         surah_start, ayah_start, surah_end, ayah_end, ayah_count,
         type, created_at
  FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

-- Recreate indexes
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
CREATE INDEX idx_sessions_type ON sessions(type);

-- Recreate triggers from 0005, updated to allow NULL duration (reject zero/negative only)

CREATE TRIGGER check_session_duration_insert
BEFORE INSERT ON sessions
BEGIN
  SELECT RAISE(ABORT, 'duration_seconds must be positive')
  WHERE NEW.duration_seconds IS NOT NULL AND NEW.duration_seconds <= 0;
END;

CREATE TRIGGER check_session_surah_range_insert
BEFORE INSERT ON sessions
BEGIN
  SELECT RAISE(ABORT, 'surah must be between 1 and 114')
  WHERE NEW.surah_start < 1 OR NEW.surah_start > 114
     OR NEW.surah_end < 1 OR NEW.surah_end > 114;
END;

CREATE TRIGGER check_session_ayah_positive_insert
BEFORE INSERT ON sessions
BEGIN
  SELECT RAISE(ABORT, 'ayah values must be positive')
  WHERE NEW.ayah_start < 1 OR NEW.ayah_end < 1 OR NEW.ayah_count < 1;
END;

CREATE TRIGGER check_session_duration_update
BEFORE UPDATE ON sessions
BEGIN
  SELECT RAISE(ABORT, 'duration_seconds must be positive')
  WHERE NEW.duration_seconds IS NOT NULL AND NEW.duration_seconds <= 0;
END;

CREATE TRIGGER check_session_surah_range_update
BEFORE UPDATE ON sessions
BEGIN
  SELECT RAISE(ABORT, 'surah must be between 1 and 114')
  WHERE NEW.surah_start < 1 OR NEW.surah_start > 114
     OR NEW.surah_end < 1 OR NEW.surah_end > 114;
END;

CREATE TRIGGER check_session_ayah_positive_update
BEFORE UPDATE ON sessions
BEGIN
  SELECT RAISE(ABORT, 'ayah values must be positive')
  WHERE NEW.ayah_start < 1 OR NEW.ayah_end < 1 OR NEW.ayah_count < 1;
END;
