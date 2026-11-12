import type { Database } from 'better-sqlite3'
import { calculateDuration } from '@shared/domain/time'
import type {
  Activity,
  ActivityFilters,
  ActivityInput,
  ActivityStatus,
  Category
} from '@shared/types'

interface ActivityRow {
  id: number
  title: string
  description: string
  date: string
  start_time: string
  end_time: string
  duration: number
  category_id: number
  priority: 'alta' | 'media' | 'baja'
  status: ActivityStatus
  created_at: string
  updated_at: string
  category_name: string
  category_color: string
  category_is_default: number
  category_created_at: string
  category_activity_count: number
}

const SELECT_ACTIVITY = `
  SELECT
    a.*,
    c.name AS category_name,
    c.color AS category_color,
    c.is_default AS category_is_default,
    c.created_at AS category_created_at,
    (SELECT COUNT(*) FROM activities x WHERE x.category_id = a.category_id) AS category_activity_count
  FROM activities a
  JOIN categories c ON c.id = a.category_id
`

export function mapActivityRow(row: ActivityRow): Activity {
  const category: Category = {
    id: row.category_id,
    name: row.category_name,
    color: row.category_color,
    isDefault: row.category_is_default === 1,
    createdAt: row.category_created_at,
    activityCount: row.category_activity_count
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    categoryId: row.category_id,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category,
    conflictIds: []
  }
}

export function listActivities(db: Database, filters: ActivityFilters = {}): Activity[] {
  const clauses: string[] = []
  const params: unknown[] = []

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`
    clauses.push('(a.title LIKE ? OR a.description LIKE ?)')
    params.push(term, term)
  }
  if (filters.categoryId) {
    clauses.push('a.category_id = ?')
    params.push(filters.categoryId)
  }
  if (filters.priority) {
    clauses.push('a.priority = ?')
    params.push(filters.priority)
  }
  if (filters.status) {
    clauses.push('a.status = ?')
    params.push(filters.status)
  }
  if (filters.from) {
    clauses.push('a.date >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    clauses.push('a.date <= ?')
    params.push(filters.to)
  }

  const direction = filters.sort === 'desc' ? 'DESC' : 'ASC'
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const sql = `${SELECT_ACTIVITY} ${where} ORDER BY a.date ${direction}, a.start_time ${direction}, a.id ${direction}`

  const rows = db.prepare(sql).all(...params) as ActivityRow[]
  return rows.map(mapActivityRow)
}

export function getActivity(db: Database, id: number): Activity | null {
  const row = db.prepare(`${SELECT_ACTIVITY} WHERE a.id = ?`).get(id) as ActivityRow | undefined
  return row ? mapActivityRow(row) : null
}

export function listActivitiesByDate(db: Database, date: string): Activity[] {
  const rows = db
    .prepare(`${SELECT_ACTIVITY} WHERE a.date = ? ORDER BY a.start_time ASC`)
    .all(date) as ActivityRow[]
  return rows.map(mapActivityRow)
}

export function listActivitiesByRange(db: Database, from: string, to: string): Activity[] {
  const rows = db
    .prepare(`${SELECT_ACTIVITY} WHERE a.date >= ? AND a.date <= ? ORDER BY a.date ASC, a.start_time ASC`)
    .all(from, to) as ActivityRow[]
  return rows.map(mapActivityRow)
}

export function createActivity(db: Database, input: ActivityInput): Activity {
  const now = new Date().toISOString()
  const duration = calculateDuration(input.startTime, input.endTime)

  const result = db
    .prepare(
      `INSERT INTO activities
        (title, description, date, start_time, end_time, duration, category_id, priority, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.title,
      input.description,
      input.date,
      input.startTime,
      input.endTime,
      duration,
      input.categoryId,
      input.priority,
      input.status,
      now,
      now
    )

  return getActivity(db, Number(result.lastInsertRowid)) as Activity
}

export function updateActivity(db: Database, id: number, input: ActivityInput): Activity | null {
  const existing = getActivity(db, id)
  if (!existing) return null

  const duration = calculateDuration(input.startTime, input.endTime)
  const now = new Date().toISOString()

  db.prepare(
    `UPDATE activities SET
      title = ?, description = ?, date = ?, start_time = ?, end_time = ?, duration = ?,
      category_id = ?, priority = ?, status = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.title,
    input.description,
    input.date,
    input.startTime,
    input.endTime,
    duration,
    input.categoryId,
    input.priority,
    input.status,
    now,
    id
  )

  return getActivity(db, id)
}

export function deleteActivity(db: Database, id: number): boolean {
  const result = db.prepare('DELETE FROM activities WHERE id = ?').run(id)
  return result.changes > 0
}

export function setActivityStatus(
  db: Database,
  id: number,
  status: ActivityStatus
): Activity | null {
  const now = new Date().toISOString()
  const result = db
    .prepare('UPDATE activities SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, now, id)
  if (result.changes === 0) return null
  return getActivity(db, id)
}

export function countActivities(db: Database): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM activities').get() as { total: number }
  return row.total
}

export function countActivitiesByCategory(db: Database, categoryId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS total FROM activities WHERE category_id = ?')
    .get(categoryId) as { total: number }
  return row.total
}
