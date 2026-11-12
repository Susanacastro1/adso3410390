import type { Database } from 'better-sqlite3'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { Settings } from '@shared/types'

export function getSettings(db: Database): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
    key: string
    value: string
  }>
  const values = new Map(rows.map((row) => [row.key, row.value]))

  const duration = Number.parseInt(values.get('default_duration') ?? '', 10)
  const week = values.get('week_starts_on')

  return {
    userName: values.get('user_name') ?? DEFAULT_SETTINGS.userName,
    workStart: values.get('work_start') ?? DEFAULT_SETTINGS.workStart,
    workEnd: values.get('work_end') ?? DEFAULT_SETTINGS.workEnd,
    defaultDuration: Number.isFinite(duration) ? duration : DEFAULT_SETTINGS.defaultDuration,
    weekStartsOn: week === 'sunday' ? 'sunday' : 'monday'
  }
}

export function saveSettings(db: Database, settings: Settings): Settings {
  const transaction = db.transaction(() => {
    const statement = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    statement.run('user_name', settings.userName)
    statement.run('work_start', settings.workStart)
    statement.run('work_end', settings.workEnd)
    statement.run('default_duration', String(settings.defaultDuration))
    statement.run('week_starts_on', settings.weekStartsOn)
  })
  transaction()
  return getSettings(db)
}

export function updateSettings(db: Database, patch: Partial<Settings>): Settings {
  const current = getSettings(db)
  const merged: Settings = {
    ...current,
    ...patch,
    userName: patch.userName !== undefined ? patch.userName : current.userName,
    workStart: patch.workStart ?? current.workStart,
    workEnd: patch.workEnd ?? current.workEnd,
    defaultDuration: patch.defaultDuration ?? current.defaultDuration,
    weekStartsOn: patch.weekStartsOn ?? current.weekStartsOn
  }
  return saveSettings(db, merged)
}

export function getSettingsRecord(db: Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
    key: string
    value: string
  }>
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}
