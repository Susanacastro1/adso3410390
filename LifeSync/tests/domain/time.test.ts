import { describe, expect, it } from 'vitest'
import {
  addMinutesToTime,
  calculateDuration,
  clampTime,
  dateToISO,
  formatDuration,
  isValidDateString,
  isValidTimeString,
  minutesToTime,
  timeToMinutes,
  todayISO
} from '@shared/domain/time'

describe('time utilities', () => {
  it('converts times to minutes and back', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('07:30')).toBe(450)
    expect(timeToMinutes('23:59')).toBe(1439)
    expect(minutesToTime(0)).toBe('00:00')
    expect(minutesToTime(450)).toBe('07:30')
    expect(minutesToTime(1439)).toBe('23:59')
  })

  it('clamps out-of-range minutes when formatting', () => {
    expect(minutesToTime(-20)).toBe('00:00')
    expect(minutesToTime(24 * 60 + 10)).toBe('23:59')
  })

  it('calculates durations between two times', () => {
    expect(calculateDuration('08:00', '09:30')).toBe(90)
    expect(calculateDuration('23:00', '23:59')).toBe(59)
    expect(calculateDuration('10:00', '10:30')).toBe(30)
  })

  it('formats durations in Spanish', () => {
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(-5)).toBe('0 min')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(90)).toBe('1 h 30 min')
    expect(formatDuration(150)).toBe('2 h 30 min')
  })

  it('validates real calendar dates only', () => {
    expect(isValidDateString('2026-11-05')).toBe(true)
    expect(isValidDateString('2024-02-29')).toBe(true)
    expect(isValidDateString('2025-02-29')).toBe(false)
    expect(isValidDateString('2026-13-01')).toBe(false)
    expect(isValidDateString('2026-04-31')).toBe(false)
    expect(isValidDateString('05-11-2026')).toBe(false)
    expect(isValidDateString('2026-1-5')).toBe(false)
  })

  it('validates times in 24-hour HH:MM format', () => {
    expect(isValidTimeString('00:00')).toBe(true)
    expect(isValidTimeString('23:59')).toBe(true)
    expect(isValidTimeString('09:05')).toBe(true)
    expect(isValidTimeString('24:00')).toBe(false)
    expect(isValidTimeString('9:05')).toBe(false)
    expect(isValidTimeString('12:60')).toBe(false)
    expect(isValidTimeString('12:5')).toBe(false)
  })

  it('formats local dates without UTC shifts', () => {
    expect(dateToISO(new Date(2026, 10, 5, 23, 30))).toBe('2026-11-05')
    expect(dateToISO(new Date(2026, 0, 1, 0, 15))).toBe('2026-01-01')
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('adds minutes and wraps at the end of the day', () => {
    expect(addMinutesToTime('08:00', 45)).toBe('08:45')
    expect(addMinutesToTime('23:30', 45)).toBe('23:59')
    expect(addMinutesToTime('00:15', -30)).toBe('00:00')
  })

  it('clamps a time inside a range', () => {
    expect(clampTime('06:00', '07:00', '22:00')).toBe('07:00')
    expect(clampTime('23:00', '07:00', '22:00')).toBe('22:00')
    expect(clampTime('12:00', '07:00', '22:00')).toBe('12:00')
  })
})
