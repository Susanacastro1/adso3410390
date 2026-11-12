import { describe, expect, it } from 'vitest'
import { computeAvailability } from '@shared/domain/availability'

describe('availability calculation', () => {
  it('returns the whole workday as free when there are no activities', () => {
    const result = computeAvailability('07:00', '22:00', [])

    expect(result.free).toEqual([{ start: '07:00', end: '22:00', duration: 900 }])
    expect(result.busyMinutes).toBe(0)
    expect(result.freeMinutes).toBe(900)
    expect(result.occupancy).toBe(0)
  })

  it('subtracts and merges overlapping busy ranges', () => {
    const result = computeAvailability('08:00', '18:00', [
      { startTime: '09:00', endTime: '10:30' },
      { startTime: '10:00', endTime: '11:00' },
      { startTime: '14:00', endTime: '15:00' }
    ])

    expect(result.free).toEqual([
      { start: '08:00', end: '09:00', duration: 60 },
      { start: '11:00', end: '14:00', duration: 180 },
      { start: '15:00', end: '18:00', duration: 180 }
    ])
    expect(result.busyMinutes).toBe(180)
    expect(result.freeMinutes).toBe(420)
    expect(result.occupancy).toBe(30)
  })

  it('clips activities outside the working window', () => {
    const result = computeAvailability('08:00', '17:00', [
      { startTime: '06:00', endTime: '09:00' },
      { startTime: '16:00', endTime: '20:00' }
    ])

    expect(result.free).toEqual([{ start: '09:00', end: '16:00', duration: 420 }])
    expect(result.busyMinutes).toBe(120)
    expect(result.freeMinutes).toBe(420)
    expect(result.occupancy).toBe(22)
  })

  it('ignores ranges that fall completely outside the working window', () => {
    const result = computeAvailability('09:00', '12:00', [
      { startTime: '06:00', endTime: '08:00' },
      { startTime: '13:00', endTime: '14:00' }
    ])

    expect(result.free).toEqual([{ start: '09:00', end: '12:00', duration: 180 }])
    expect(result.busyMinutes).toBe(0)
    expect(result.occupancy).toBe(0)
  })

  it('handles a fully busy day', () => {
    const result = computeAvailability('08:00', '12:00', [
      { startTime: '08:00', endTime: '12:00' }
    ])

    expect(result.free).toEqual([])
    expect(result.busyMinutes).toBe(240)
    expect(result.freeMinutes).toBe(0)
    expect(result.occupancy).toBe(100)
  })

  it('returns an empty result for an invalid working window', () => {
    expect(computeAvailability('18:00', '08:00', [])).toEqual({
      free: [],
      busyMinutes: 0,
      freeMinutes: 0,
      occupancy: 0
    })
    expect(computeAvailability('08:00', '08:00', [])).toEqual({
      free: [],
      busyMinutes: 0,
      freeMinutes: 0,
      occupancy: 0
    })
  })
})
