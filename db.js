import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dbPath = process.env.DB_PATH || './data/raxion-demo.sqlite';
const resolvedPath = path.resolve(process.cwd(), dbPath);
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    slug TEXT,
    url TEXT,
    referrer TEXT,
    started_at TEXT,
    ended_at TEXT,
    total_duration INTEGER,
    session_json TEXT NOT NULL,
    reported_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_reported_at ON sessions(reported_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
`);

const upsertStmt = db.prepare(`
  INSERT INTO sessions (
    id, slug, url, referrer, started_at, ended_at, total_duration, session_json, reported_at, created_at, updated_at
  ) VALUES (
    @id, @slug, @url, @referrer, @started_at, @ended_at, @total_duration, @session_json, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
  ON CONFLICT(id) DO UPDATE SET
    slug = excluded.slug,
    url = excluded.url,
    referrer = excluded.referrer,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    total_duration = excluded.total_duration,
    session_json = excluded.session_json,
    updated_at = CURRENT_TIMESTAMP
`);

const pendingStmt = db.prepare(`
  SELECT id, session_json
  FROM sessions
  WHERE reported_at IS NULL
  ORDER BY datetime(started_at) DESC
`);

const markReportedStmt = db.prepare(`
  UPDATE sessions
  SET reported_at = @reportedAt,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
`);

export function getDbPath() {
  return resolvedPath;
}

export function upsertSession(session) {
  upsertStmt.run({
    id: session.id,
    slug: session.slug || 'Unknown',
    url: session.url || '',
    referrer: session.referrer || 'direct',
    started_at: session.startedAt || null,
    ended_at: session.endedAt || null,
    total_duration: Number(session.totalDuration || 0),
    session_json: JSON.stringify(session),
  });
}

export function getPendingSessions() {
  return pendingStmt.all().map((row) => JSON.parse(row.session_json));
}

export function markSessionsReported(sessionIds, reportedAt = new Date().toISOString()) {
  const tx = db.transaction((ids) => {
    for (const id of ids) {
      markReportedStmt.run({ id, reportedAt });
    }
  });
  tx(sessionIds);
}
