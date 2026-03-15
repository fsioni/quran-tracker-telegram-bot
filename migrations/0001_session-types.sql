ALTER TABLE sessions ADD COLUMN type TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE sessions ADD COLUMN page_start INTEGER;
ALTER TABLE sessions ADD COLUMN page_end INTEGER;
CREATE INDEX idx_sessions_type ON sessions(type);
