import type { Database } from 'better-sqlite3'
import { computeAvailability } from '@shared/domain/availability'
import { dateToISO } from '@shared/domain/time'
import type { DayAvailability, RangeAvailability } from '@shared/types'
import { listActivitiesByDate } from '../repositories/activitiesRepository'
import { getSettings } from '../repositories/settingsRepository'

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  return dateToISO(new Date(year, month - 1, day + days))
}

export function getDayAvailability(db: Database, date: string): DayAvailability {
  const settings = getSettings(db)
  const activities = listActivitiesByDate(db, date)
  const availability = computeAvailability(
    settings.workStart,
    settings.workEnd,
    activities.map((activity) => ({
      startTime: activity.startTime,
      endTime: activity.endTime
    }))
  )

  return {
    date,
    workStart: settings.workStart,
    workEnd: settings.workEnd,
    busy: activities.map((activity) => ({
      activityId: activity.id,
      title: activity.title,
      startTime: activity.startTime,
      endTime: activity.endTime,
      categoryColor: activity.category.color,
      status: activity.status
    })),
    free: availability.free,
    busyMinutes: availability.busyMinutes,
    freeMinutes: availability.freeMinutes,
    occupancy: availability.occupancy
  }
}

export function getRangeAvailability(
  db: Database,
  from: string,
  days = 7
): RangeAvailability[] {
  const total = Math.max(1, Math.min(31, days))
  return Array.from({ length: total }, (_, index) => {
    const date = addDays(from, index)
    const day = getDayAvailability(db, date)
    return {
      date,
      freeMinutes: day.freeMinutes,
      busyMinutes: day.busyMinutes,
      occupancy: day.occupancy
    }
  })
}
