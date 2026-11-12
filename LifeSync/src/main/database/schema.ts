import type { Database } from 'better-sqlite3'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '@shared/constants'

export const SCHEMA_VERSION = 1

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  priority TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendiente',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CHECK (length(trim(title)) BETWEEN 1 AND 120),
  CHECK (length(description) <= 1000),
  CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  CHECK (end_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  CHECK (end_time > start_time),
  CHECK (duration > 0),
  CHECK (priority IN ('alta', 'media', 'baja')),
  CHECK (status IN ('pendiente', 'completada'))
);

CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`

export function migrate(db: Database): void {
  db.exec(SCHEMA_SQL)

  const row = db
    .prepare('SELECT MAX(version) AS version FROM schema_migrations')
    .get() as { version: number | null } | undefined

  const current = row?.version ?? 0
  if (current < SCHEMA_VERSION) {
    db.prepare('INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      SCHEMA_VERSION,
      new Date().toISOString()
    )
  }
}

export function seedInitialData(db: Database): void {
  const now = new Date().toISOString()

  const count = db.prepare('SELECT COUNT(*) AS total FROM categories').get() as { total: number }
  if (count.total === 0) {
    const insert = db.prepare(
      'INSERT INTO categories (name, color, is_default, created_at) VALUES (?, ?, 1, ?)'
    )
    for (const category of DEFAULT_CATEGORIES) {
      insert.run(category.name, category.color, now)
    }
  }

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  insertSetting.run('user_name', DEFAULT_SETTINGS.userName)
  insertSetting.run('work_start', DEFAULT_SETTINGS.workStart)
  insertSetting.run('work_end', DEFAULT_SETTINGS.workEnd)
  insertSetting.run('default_duration', String(DEFAULT_SETTINGS.defaultDuration))
  insertSetting.run('week_starts_on', DEFAULT_SETTINGS.weekStartsOn)
}
