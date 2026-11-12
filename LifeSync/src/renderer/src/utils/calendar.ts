import { timeToMinutes } from '@shared/domain/time'
import type { Activity } from '@shared/types'

export interface PositionedActivity {
  activity: Activity
  column: number
  columns: number
}

/**
 * Distribuye actividades solapadas en columnas para que todas sean visibles.
 * Agrupa primero por cadenas de solapamiento y después asigna la primera
 * columna libre de cada grupo.
 */
export function layoutDayActivities(activities: Activity[]): PositionedActivity[] {
  const sorted = [...activities].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime)
  )

  const groups: Activity[][] = []
  let current: Activity[] = []
  let groupEnd = ''

  for (const activity of sorted) {
    if (current.length === 0) {
      current = [activity]
      groupEnd = activity.endTime
      continue
    }
    if (activity.startTime < groupEnd) {
      current.push(activity)
      if (activity.endTime > groupEnd) groupEnd = activity.endTime
    } else {
      groups.push(current)
      current = [activity]
      groupEnd = activity.endTime
    }
  }
  if (current.length > 0) groups.push(current)

  const result: PositionedActivity[] = []
  for (const group of groups) {
    const columnEnds: number[] = []
    const assignments: Array<{ activity: Activity; column: number }> = []

    for (const activity of group) {
      const start = timeToMinutes(activity.startTime)
      const end = timeToMinutes(activity.endTime)
      let column = columnEnds.findIndex((columnEnd) => columnEnd <= start)
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(end)
      } else {
        columnEnds[column] = end
      }
      assignments.push({ activity, column })
    }

    const columns = Math.max(1, columnEnds.length)
    for (const assignment of assignments) {
      result.push({ ...assignment, columns })
    }
  }

  return result
}

export const CALENDAR_START_HOUR = 0
export const CALENDAR_END_HOUR = 24
export const HOUR_HEIGHT = 64
export const SLOT_MINUTES = 30
export const SLOT_HEIGHT = (HOUR_HEIGHT * SLOT_MINUTES) / 60

export const TIME_SLOTS = Array.from(
  { length: (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * (60 / SLOT_MINUTES) },
  (_, index) => CALENDAR_START_HOUR * 60 + index * SLOT_MINUTES
)

export function eventPosition(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  const top = ((start - CALENDAR_START_HOUR * 60) / 60) * HOUR_HEIGHT
  const height = Math.max(24, ((end - start) / 60) * HOUR_HEIGHT)
  return { top, height }
}

export function minutesToOffset(minutes: number): number {
  return ((minutes - CALENDAR_START_HOUR * 60) / 60) * HOUR_HEIGHT
}
