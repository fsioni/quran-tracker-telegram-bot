-- SQLite ne supporte pas ALTER TABLE ADD CONSTRAINT.
-- Les CHECK constraints doivent etre ajoutees a la creation.
-- On utilise des triggers pour valider les donnees a l'insertion/update.

CREATE TRIGGER check_session_duration_insert
BEFORE INSERT ON sessions
BEGIN
  SELECT RAISE(ABORT, 'duration_seconds must be positive')
  WHERE NEW.duration_seconds <= 0;
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
