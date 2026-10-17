-- RoadGuard citizen issue registry (PostgreSQL)
CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    report_count INTEGER NOT NULL DEFAULT 1,
    priority_score INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issue_photos (
    id BIGSERIAL PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    filename TEXT,
    mime_type TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    image BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS issue_reports (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    reported_at TEXT NOT NULL
);

-- Chitti's durable event memory/audit history (existing runtime table).
CREATE TABLE IF NOT EXISTS system_event_log (
    id BIGSERIAL PRIMARY KEY,
    actor TEXT NOT NULL,
    event_type TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_photos_issue_id ON issue_photos(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_issue_id ON issue_reports(issue_id);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_system_event_log_created ON system_event_log(created_at DESC);
