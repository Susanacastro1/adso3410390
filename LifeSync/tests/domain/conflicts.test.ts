import { describe, expect, it } from 'vitest'
import {
  findAllConflictIds,
  findConflicts,
  intervalsOverlap,
  type ConflictActivity
} from '@shared/domain/conflicts'

function activity(
  id: number,
  date: string,
  startTime: string,
  endTime: string
): ConflictActivity {
  return { id, date, startTime, endTime }
}

describe('conflict detection', () => {
  it('detects overlapping intervals but not adjacent ones', () => {
    expect(intervalsOverlap('08:00', '09:00', '08:30', '09:30')).toBe(true)
    expect(intervalsOverlap('08:00', '09:00', '08:00', '09:00')).toBe(true)
    expect(intervalsOverlap('08:00', '09:00', '07:00', '08:00')).toBe(false)
    expect(intervalsOverlap('08:00', '09:00', '09:00', '10:00')).toBe(false)
    expect(intervalsOverlap('08:00', '09:00', '07:00', '10:00')).toBe(true)
  })

  it('only compares activities on the same date', () => {
    const activities = [
      activity(1, '2026-11-05', '08:00', '09:00'),
      activity(2, '2026-11-06', '08:30', '09:30')
    ]

    expect(
      findConflicts({ date: '2026-11-05', startTime: '08:30', endTime: '09:15' }, activities)
    ).toEqual([activities[0]])
    expect(
      findConflicts({ date: '2026-11-07', startTime: '08:30', endTime: '09:15' }, activities)
    ).toEqual([])
  })

  it('excludes the activity being edited', () => {
    const activities = [
      activity(1, '2026-11-05', '08:00', '09:00'),
      activity(2, '2026-11-05', '08:30', '09:30')
    ]

    expect(
      findConflicts({ date: '2026-11-05', startTime: '08:15', endTime: '08:45' }, activities, 1)
    ).toEqual([activities[1]])
    expect(
      findConflicts({ date: '2026-11-05', startTime: '08:15', endTime: '08:45' }, activities, 2)
    ).toEqual([activities[0]])
  })

  it('collects every activity involved in a conflict', () => {
    const activities = [
      activity(1, '2026-11-05', '08:00', '09:00'),
      activity(2, '2026-11-05', '08:30', '09:30'),
      activity(3, '2026-11-05', '10:00', '11:00'),
      activity(4, '2026-11-05', '10:30', '11:30'),
      activity(5, '2026-11-06', '08:00', '09:00'),
      activity(6, '2026-11-06', '09:00', '10:00')
    ]

    expect(findAllConflictIds(activities)).toEqual(new Set([1, 2, 3, 4]))
  })

  it('returns no conflicts for a single activity', () => {
    expect(findAllConflictIds([activity(1, '2026-11-05', '08:00', '09:00')])).toEqual(new Set())
    expect(findAllConflictIds([])).toEqual(new Set())
  })
})
