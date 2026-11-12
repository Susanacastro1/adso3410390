import { timeToMinutes, minutesToTime } from './time'
import type { FreeSlot } from '../types'

export interface BusyRange {
  startTime: string
  endTime: string
}

export interface AvailabilityResult {
  free: FreeSlot[]
  busyMinutes: number
  freeMinutes: number
  occupancy: number
}

export function computeAvailability(
  workStart: string,
  workEnd: string,
  busyRanges: BusyRange[]
): AvailabilityResult {
  const windowStart = timeToMinutes(workStart)
  const windowEnd = timeToMinutes(workEnd)

  if (windowEnd <= windowStart) {
    return { free: [], busyMinutes: 0, freeMinutes: 0, occupancy: 0 }
  }

  const clipped = busyRanges
    .map((range) => ({
      start: Math.max(windowStart, timeToMinutes(range.startTime)),
      end: Math.min(windowEnd, timeToMinutes(range.endTime))
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start)

  const merged: Array<{ start: number; end: number }> = []
  for (const range of clipped) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }

  const free: FreeSlot[] = []
  let cursor = windowStart

  for (const range of merged) {
    if (range.start > cursor) {
      free.push({
        start: minutesToTime(cursor),
        end: minutesToTime(range.start),
        duration: range.start - cursor
      })
    }
    cursor = Math.max(cursor, range.end)
  }

  if (cursor < windowEnd) {
    free.push({
      start: minutesToTime(cursor),
      end: minutesToTime(windowEnd),
      duration: windowEnd - cursor
    })
  }

  const busyMinutes = merged.reduce((total, range) => total + (range.end - range.start), 0)
  const freeMinutes = Math.max(0, windowEnd - windowStart - busyMinutes)
  const occupancy = windowEnd - windowStart > 0
    ? Math.round((busyMinutes / (windowEnd - windowStart)) * 100)
    : 0

  return { free, busyMinutes, freeMinutes, occupancy }
}
