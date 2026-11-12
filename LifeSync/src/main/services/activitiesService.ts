import type { Database } from 'better-sqlite3'
import { findConflicts } from '@shared/domain/conflicts'
import type {
  Activity,
  ActivityFilters,
  ActivityInput,
  ActivityStatus,
  ConflictCheck
} from '@shared/types'
import { AppError } from '../errors'
import {
  createActivity,
  getActivity,
  listActivities,
  listActivitiesByDate,
  setActivityStatus,
  updateActivity
} from '../repositories/activitiesRepository'

function decorate(activity: Activity, all: Activity[]): Activity {
  const conflicts = findConflicts(activity, all, activity.id)
  return { ...activity, conflictIds: conflicts.map((item) => item.id) }
}

export function listWithConflicts(db: Database, filters: ActivityFilters = {}): Activity[] {
  const all = listActivities(db, {})
  const filtered = listActivities(db, filters)
  return filtered.map((activity) => decorate(activity, all))
}

export function getWithConflicts(db: Database, id: number): Activity | null {
  const activity = getActivity(db, id)
  if (!activity) return null
  return decorate(activity, listActivitiesByDate(db, activity.date))
}

export function checkConflicts(
  db: Database,
  input: ActivityInput,
  excludeId?: number
): ConflictCheck {
  const sameDay = listActivitiesByDate(db, input.date)
  const conflicts = findConflicts(input, sameDay, excludeId)
  return {
    conflicts: conflicts.map((activity) => decorate(activity, sameDay))
  }
}

export function createWithConflicts(
  db: Database,
  input: ActivityInput,
  force = false
): Activity {
  const found = checkConflicts(db, input).conflicts
  if (found.length > 0 && !force) {
    throw new AppError(
      'CONFLICT',
      'La actividad se superpone con otras actividades del mismo día',
      { conflicts: found }
    )
  }
  const created = createActivity(db, input)
  return decorate(created, listActivitiesByDate(db, created.date))
}

export function updateWithConflicts(
  db: Database,
  id: number,
  input: ActivityInput,
  force = false
): Activity | null {
  const found = checkConflicts(db, input, id).conflicts
  if (found.length > 0 && !force) {
    throw new AppError(
      'CONFLICT',
      'La actividad se superpone con otras actividades del mismo día',
      { conflicts: found }
    )
  }
  const updated = updateActivity(db, id, input)
  if (!updated) return null
  return decorate(updated, listActivitiesByDate(db, updated.date))
}

export function toggleStatus(db: Database, id: number, status: ActivityStatus): Activity | null {
  const updated = setActivityStatus(db, id, status)
  if (!updated) return null
  return decorate(updated, listActivitiesByDate(db, updated.date))
}
