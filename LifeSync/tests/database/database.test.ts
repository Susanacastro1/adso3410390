import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from 'better-sqlite3'
import { createDatabase } from '../../src/main/database/connection'
import { AppError } from '../../src/main/errors'
import {
  countActivities,
  createActivity,
  deleteActivity,
  getActivity,
  listActivities,
  listActivitiesByDate,
  listActivitiesByRange,
  setActivityStatus,
  updateActivity
} from '../../src/main/repositories/activitiesRepository'
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory
} from '../../src/main/repositories/categoriesRepository'
import {
  getSettings,
  saveSettings,
  updateSettings
} from '../../src/main/repositories/settingsRepository'
import {
  checkConflicts,
  createWithConflicts,
  listWithConflicts,
  toggleStatus,
  updateWithConflicts
} from '../../src/main/services/activitiesService'
import { getDayAvailability, getRangeAvailability } from '../../src/main/services/availabilityService'
import { getDashboardStats } from '../../src/main/services/dashboardService'
import { dateToISO } from '@shared/domain/time'
import type { ActivityInput, Settings } from '@shared/types'

let db: Database

const BASE_INPUT: ActivityInput = {
  title: 'Estudiar matemáticas',
  description: 'Repasar derivadas',
  date: '2026-11-05',
  startTime: '08:00',
  endTime: '09:30',
  categoryId: 2,
  priority: 'alta',
  status: 'pendiente'
}

function input(overrides: Partial<ActivityInput> = {}): ActivityInput {
  return { ...BASE_INPUT, ...overrides }
}

function today(): string {
  return dateToISO(new Date())
}

beforeEach(() => {
  db = createDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

describe('database initialization', () => {
  it('creates the schema, default categories and default settings', () => {
    const categories = listCategories(db)
    expect(categories).toHaveLength(5)
    expect(categories.map((category) => category.name)).toEqual([
      'Personal',
      'Académica',
      'Laboral',
      'Salud',
      'Otros'
    ])
    expect(categories.every((category) => category.isDefault)).toBe(true)
    expect(categories.every((category) => category.activityCount === 0)).toBe(true)

    expect(getSettings(db)).toEqual({
      userName: '',
      workStart: '07:00',
      workEnd: '22:00',
      defaultDuration: 60,
      weekStartsOn: 'monday'
    })

    const version = db
      .prepare('SELECT MAX(version) AS version FROM schema_migrations')
      .get() as { version: number }
    expect(version.version).toBe(1)
  })

  it('enables foreign keys', () => {
    const result = db.pragma('foreign_keys', { simple: true })
    expect(result).toBe(1)
  })
})

describe('activities repository', () => {
  it('creates an activity and calculates its duration', () => {
    const created = createActivity(db, input())

    expect(created.id).toBe(1)
    expect(created.title).toBe('Estudiar matemáticas')
    expect(created.duration).toBe(90)
    expect(created.category.name).toBe('Académica')
    expect(created.category.activityCount).toBe(1)
    expect(created.conflictIds).toEqual([])
    expect(created.createdAt).toBeTruthy()
    expect(created.updatedAt).toBe(created.createdAt)
    expect(countActivities(db)).toBe(1)
  })

  it('gets, updates and deletes an activity', () => {
    const created = createActivity(db, input())

    expect(getActivity(db, created.id)?.title).toBe('Estudiar matemáticas')
    expect(getActivity(db, 999)).toBeNull()

    const updated = updateActivity(
      db,
      created.id,
      input({
        title: 'Estudiar física',
        startTime: '10:00',
        endTime: '12:15',
        priority: 'baja'
      })
    )

    expect(updated).not.toBeNull()
    expect(updated?.title).toBe('Estudiar física')
    expect(updated?.duration).toBe(135)
    expect(updated?.priority).toBe('baja')
    expect(updated?.createdAt).toBe(created.createdAt)

    expect(updateActivity(db, 999, input())).toBeNull()
    expect(deleteActivity(db, created.id)).toBe(true)
    expect(deleteActivity(db, created.id)).toBe(false)
    expect(countActivities(db)).toBe(0)
  })

  it('changes the status of an activity', () => {
    const created = createActivity(db, input())
    const completed = setActivityStatus(db, created.id, 'completada')

    expect(completed?.status).toBe('completada')
    expect(setActivityStatus(db, 999, 'completada')).toBeNull()
  })

  it('lists activities by date and range', () => {
    createActivity(db, input({ date: '2026-11-03', startTime: '10:00', endTime: '11:00' }))
    createActivity(db, input({ date: '2026-11-05', startTime: '09:00', endTime: '10:00' }))
    createActivity(db, input({ date: '2026-11-05', startTime: '08:00', endTime: '08:30' }))

    const day = listActivitiesByDate(db, '2026-11-05')
    expect(day).toHaveLength(2)
    expect(day.map((activity) => activity.startTime)).toEqual(['08:00', '09:00'])

    const range = listActivitiesByRange(db, '2026-11-04', '2026-11-06')
    expect(range).toHaveLength(2)
    expect(range.every((activity) => activity.date === '2026-11-05')).toBe(true)
  })

  it('filters by search, category, priority, status and dates', () => {
    createActivity(
      db,
      input({
        title: 'Reunión de equipo',
        description: 'Sincronización semanal',
        date: '2026-11-05',
        categoryId: 3,
        priority: 'alta',
        status: 'pendiente'
      })
    )
    createActivity(
      db,
      input({
        title: 'Caminar',
        description: 'Ejercicio al aire libre',
        date: '2026-11-07',
        categoryId: 4,
        priority: 'baja',
        status: 'completada'
      })
    )

    expect(listActivities(db, { search: 'reunión' })).toHaveLength(1)
    expect(listActivities(db, { search: 'EJERCICIO' })).toHaveLength(1)
    expect(listActivities(db, { search: 'inexistente' })).toHaveLength(0)
    expect(listActivities(db, { categoryId: 4 })).toHaveLength(1)
    expect(listActivities(db, { priority: 'alta' })).toHaveLength(1)
    expect(listActivities(db, { status: 'completada' })).toHaveLength(1)
    expect(listActivities(db, { from: '2026-11-06' })).toHaveLength(1)
    expect(listActivities(db, { to: '2026-11-06' })).toHaveLength(1)
    expect(listActivities(db, { from: '2026-11-05', to: '2026-11-07' })).toHaveLength(2)
  })

  it('sorts ascending by default and descending when requested', () => {
    createActivity(db, input({ date: '2026-11-07' }))
    createActivity(db, input({ date: '2026-11-05' }))

    expect(listActivities(db, {}).map((activity) => activity.date)).toEqual([
      '2026-11-05',
      '2026-11-07'
    ])
    expect(listActivities(db, { sort: 'desc' }).map((activity) => activity.date)).toEqual([
      '2026-11-07',
      '2026-11-05'
    ])
  })
})

describe('conflict-aware activity service', () => {
  it('blocks overlapping activities unless force is used', () => {
    const first = createWithConflicts(db, input())

    expect(() =>
      createWithConflicts(
        db,
        input({ title: 'Otra actividad', startTime: '09:00', endTime: '10:00' })
      )
    ).toThrowError(AppError)

    try {
      createWithConflicts(
        db,
        input({ title: 'Otra actividad', startTime: '09:00', endTime: '10:00' })
      )
    } catch (error) {
      const appError = error as AppError
      expect(appError.code).toBe('CONFLICT')
      expect((appError.details as { conflicts: unknown[] }).conflicts).toHaveLength(1)
    }

    const forced = createWithConflicts(
      db,
      input({ title: 'Otra actividad', startTime: '09:00', endTime: '10:00' }),
      true
    )

    expect(forced.conflictIds).toEqual([first.id])
    expect(countActivities(db)).toBe(2)
  })

  it('allows adjacent activities and reports conflicts for the whole list', () => {
    createWithConflicts(db, input({ startTime: '08:00', endTime: '09:00' }))
    createWithConflicts(db, input({ title: 'Almuerzo', startTime: '09:00', endTime: '10:00' }))

    const list = listWithConflicts(db)
    expect(list).toHaveLength(2)
    expect(list.every((activity) => activity.conflictIds.length === 0)).toBe(true)
  })

  it('checks conflicts while excluding the edited activity', () => {
    const created = createWithConflicts(db, input())

    const check = checkConflicts(
      db,
      input({ title: 'Cambiada', startTime: '08:30', endTime: '09:30' }),
      created.id
    )
    expect(check.conflicts).toEqual([])

    const overlapping = checkConflicts(db, input({ startTime: '08:30', endTime: '09:30' }))
    expect(overlapping.conflicts.map((activity) => activity.id)).toEqual([created.id])
  })

  it('blocks an update that overlaps another activity unless forced', () => {
    createWithConflicts(db, input({ title: 'Primera', startTime: '08:00', endTime: '09:00' }))
    const second = createWithConflicts(
      db,
      input({ title: 'Segunda', startTime: '10:00', endTime: '11:00' })
    )

    expect(() =>
      updateWithConflicts(
        db,
        second.id,
        input({ title: 'Segunda', startTime: '08:30', endTime: '09:30' })
      )
    ).toThrowError(/superpone/)

    const forced = updateWithConflicts(
      db,
      second.id,
      input({ title: 'Segunda', startTime: '08:30', endTime: '09:30' }),
      true
    )
    expect(forced?.conflictIds).toHaveLength(1)
  })

  it('toggles status and decorates conflicts', () => {
    const first = createWithConflicts(db, input({ startTime: '08:00', endTime: '09:00' }))
    const second = createWithConflicts(
      db,
      input({ title: 'Segunda', startTime: '08:30', endTime: '09:30' }),
      true
    )

    const toggled = toggleStatus(db, second.id, 'completada')
    expect(toggled?.status).toBe('completada')
    expect(toggled?.conflictIds).toEqual([first.id])
    expect(toggleStatus(db, 999, 'completada')).toBeNull()
  })
})

describe('categories repository', () => {
  it('creates and updates a category', () => {
    const created = createCategory(db, { name: '  Música  ', color: '#123456' })

    expect(created.name).toBe('Música')
    expect(created.color).toBe('#123456')
    expect(created.isDefault).toBe(false)
    expect(created.activityCount).toBe(0)

    const updated = updateCategory(db, created.id, { name: 'Arte', color: '#654321' })
    expect(updated.name).toBe('Arte')
    expect(updated.color).toBe('#654321')
  })

  it('rejects duplicate names ignoring case and surrounding spaces', () => {
    createCategory(db, { name: 'Música', color: '#123456' })

    expect(() => createCategory(db, { name: 'MÚSICA', color: '#123456' })).toThrowError(
      AppError
    )
    expect(() => createCategory(db, { name: '  música  ', color: '#123456' })).toThrowError(
      /Ya existe/
    )
  })

  it('rejects duplicate names when updating', () => {
    const music = createCategory(db, { name: 'Música', color: '#123456' })
    const art = createCategory(db, { name: 'Arte', color: '#654321' })

    expect(() => updateCategory(db, art.id, { name: 'Música', color: '#654321' })).toThrowError(
      /Ya existe/
    )
    expect(() => updateCategory(db, 999, { name: 'Otra', color: '#654321' })).toThrowError(
      /no existe/
    )
    expect(updateCategory(db, music.id, { name: 'Música', color: '#111111' }).color).toBe(
      '#111111'
    )
  })

  it('protects the Otros category and categories in use', () => {
    const others = listCategories(db).find((category) => category.name === 'Otros')
    expect(others).toBeDefined()

    expect(() => deleteCategory(db, others!.id)).toThrowError(/no se puede eliminar/)

    const created = createActivity(db, input())
    expect(() => deleteCategory(db, created.categoryId)).toThrowError(/actividades asociadas/)

    try {
      deleteCategory(db, created.categoryId)
    } catch (error) {
      const appError = error as AppError
      expect(appError.code).toBe('CATEGORY_IN_USE')
      expect(appError.details).toEqual({ activityCount: 1 })
    }
  })

  it('reassigns activities before deleting a category', () => {
    const created = createActivity(db, input({ categoryId: 2 }))
    const destination = createCategory(db, { name: 'Temporal', color: '#ABCDEF' })

    deleteCategory(db, 2, destination.id)

    expect(getCategory(db, 2)).toBeNull()
    expect(getActivity(db, created.id)?.categoryId).toBe(destination.id)
    expect(getCategory(db, destination.id)?.activityCount).toBe(1)
  })

  it('rejects an invalid reassignment destination', () => {
    createActivity(db, input({ categoryId: 2 }))
    const destination = createCategory(db, { name: 'Temporal', color: '#ABCDEF' })

    expect(() => deleteCategory(db, 2, 2)).toThrowError(/diferente/)
    expect(() => deleteCategory(db, 2, 999)).toThrowError(/destino no existe/)
    expect(() => deleteCategory(db, 999)).toThrowError(/no existe/)
    expect(getCategory(db, destination.id)).not.toBeNull()
  })
})

describe('settings repository', () => {
  it('saves and updates settings partially', () => {
    const values: Settings = {
      userName: 'Ana',
      workStart: '08:30',
      workEnd: '17:30',
      defaultDuration: 45,
      weekStartsOn: 'sunday'
    }

    expect(saveSettings(db, values)).toEqual(values)
    expect(getSettings(db)).toEqual(values)

    const updated = updateSettings(db, { userName: 'Luis', defaultDuration: 90 })
    expect(updated).toEqual({ ...values, userName: 'Luis', defaultDuration: 90 })
  })

  it('falls back to defaults when a stored value is invalid', () => {
    db.prepare("UPDATE settings SET value = 'no-numero' WHERE key = 'default_duration'").run()
    db.prepare("UPDATE settings SET value = 'viernes' WHERE key = 'week_starts_on'").run()

    const values = getSettings(db)
    expect(values.defaultDuration).toBe(60)
    expect(values.weekStartsOn).toBe('monday')
  })
})

describe('availability service', () => {
  it('returns free slots and busy blocks for a day', () => {
    updateSettings(db, { workStart: '08:00', workEnd: '12:00' })
    const morning = createActivity(db, input({ startTime: '09:00', endTime: '10:00' }))

    const day = getDayAvailability(db, '2026-11-05')

    expect(day.workStart).toBe('08:00')
    expect(day.workEnd).toBe('12:00')
    expect(day.busy).toEqual([
      {
        activityId: morning.id,
        title: 'Estudiar matemáticas',
        startTime: '09:00',
        endTime: '10:00',
        categoryColor: '#4F86C6',
        status: 'pendiente'
      }
    ])
    expect(day.free).toEqual([
      { start: '08:00', end: '09:00', duration: 60 },
      { start: '10:00', end: '12:00', duration: 120 }
    ])
    expect(day.busyMinutes).toBe(60)
    expect(day.freeMinutes).toBe(180)
    expect(day.occupancy).toBe(25)
  })

  it('returns a range of days, clamped between 1 and 31', () => {
    updateSettings(db, { workStart: '08:00', workEnd: '10:00' })

    const week = getRangeAvailability(db, '2026-11-05', 7)
    expect(week).toHaveLength(7)
    expect(week[0]).toEqual({
      date: '2026-11-05',
      freeMinutes: 120,
      busyMinutes: 0,
      occupancy: 0
    })
    expect(week[6].date).toBe('2026-11-11')

    expect(getRangeAvailability(db, '2026-11-05', 0)).toHaveLength(1)
    expect(getRangeAvailability(db, '2026-11-05', 100)).toHaveLength(31)
  })
})

describe('dashboard service', () => {
  it('summarizes activities, priorities, conflicts and categories', () => {
    const day = today()

    createActivity(
      db,
      input({ date: day, startTime: '08:00', endTime: '09:00', priority: 'alta' })
    )
    createActivity(
      db,
      input({
        title: 'Reunión',
        date: day,
        startTime: '08:30',
        endTime: '09:30',
        priority: 'media',
        categoryId: 3,
        status: 'completada'
      })
    )
    createActivity(
      db,
      input({
        title: 'Caminar',
        date: '2099-01-01',
        startTime: '18:00',
        endTime: '19:00',
        priority: 'baja',
        categoryId: 4
      })
    )

    const stats = getDashboardStats(db)

    expect(stats.total).toBe(3)
    expect(stats.pending).toBe(2)
    expect(stats.completed).toBe(1)
    expect(stats.highPriority).toBe(1)
    expect(stats.todayCount).toBe(2)
    expect(stats.todayPending).toBe(1)
    expect(stats.completionRate).toBe(33)
    expect(stats.conflictCount).toBe(2)
    expect(stats.upcoming.map((activity) => activity.title)).toContain('Caminar')
    expect(stats.todayActivities).toHaveLength(2)
    expect(stats.byCategory).toEqual([
      { categoryId: 2, name: 'Académica', color: '#4F86C6', count: 1 },
      { categoryId: 3, name: 'Laboral', color: '#D97706', count: 1 },
      { categoryId: 4, name: 'Salud', color: '#2E9E6B', count: 1 }
    ])
  })

  it('returns zeroed metrics when there are no activities', () => {
    const stats = getDashboardStats(db)

    expect(stats.total).toBe(0)
    expect(stats.pending).toBe(0)
    expect(stats.completed).toBe(0)
    expect(stats.todayCount).toBe(0)
    expect(stats.completionRate).toBe(0)
    expect(stats.upcoming).toEqual([])
    expect(stats.byCategory).toEqual([])
    expect(stats.conflictCount).toBe(0)
    expect(stats.weekBars).toHaveLength(7)
  })
})
