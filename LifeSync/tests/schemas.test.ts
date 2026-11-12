import { describe, expect, it } from 'vitest'
import {
  activityInputSchema,
  backupSchema,
  categoryInputSchema,
  settingsPatchSchema
} from '@shared/schemas'

const validActivity = {
  title: '  Estudiar  ',
  description: '',
  date: '2026-11-05',
  startTime: '08:00',
  endTime: '09:30',
  categoryId: 2,
  priority: 'alta',
  status: 'pendiente'
}

describe('activityInputSchema', () => {
  it('accepts and normalizes a valid activity', () => {
    const result = activityInputSchema.safeParse(validActivity)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Estudiar')
      expect(result.data.description).toBe('')
    }
  })

  it('rejects invalid titles', () => {
    expect(activityInputSchema.safeParse({ ...validActivity, title: '   ' }).success).toBe(false)
    expect(
      activityInputSchema.safeParse({ ...validActivity, title: 'a'.repeat(121) }).success
    ).toBe(false)
  })

  it('rejects impossible dates and malformed times', () => {
    expect(activityInputSchema.safeParse({ ...validActivity, date: '2026-02-30' }).success).toBe(
      false
    )
    expect(activityInputSchema.safeParse({ ...validActivity, date: '05/11/2026' }).success).toBe(
      false
    )
    expect(activityInputSchema.safeParse({ ...validActivity, startTime: '8:00' }).success).toBe(
      false
    )
    expect(activityInputSchema.safeParse({ ...validActivity, endTime: '25:00' }).success).toBe(
      false
    )
  })

  it('requires the end time to be later than the start time', () => {
    const same = activityInputSchema.safeParse({
      ...validActivity,
      startTime: '09:00',
      endTime: '09:00'
    })
    const reversed = activityInputSchema.safeParse({
      ...validActivity,
      startTime: '10:00',
      endTime: '09:00'
    })

    expect(same.success).toBe(false)
    expect(reversed.success).toBe(false)
  })

  it('requires a positive category and known priority/status', () => {
    expect(activityInputSchema.safeParse({ ...validActivity, categoryId: 0 }).success).toBe(false)
    expect(activityInputSchema.safeParse({ ...validActivity, categoryId: 1.5 }).success).toBe(
      false
    )
    expect(activityInputSchema.safeParse({ ...validActivity, priority: 'urgente' }).success).toBe(
      false
    )
    expect(activityInputSchema.safeParse({ ...validActivity, status: 'archivada' }).success).toBe(
      false
    )
  })
})

describe('categoryInputSchema', () => {
  it('accepts a valid category', () => {
    const result = categoryInputSchema.safeParse({ name: '  Música  ', color: '#A1B2C3' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Música')
  })

  it('rejects empty, long or invalid categories', () => {
    expect(categoryInputSchema.safeParse({ name: '', color: '#A1B2C3' }).success).toBe(false)
    expect(
      categoryInputSchema.safeParse({ name: 'a'.repeat(31), color: '#A1B2C3' }).success
    ).toBe(false)
    expect(categoryInputSchema.safeParse({ name: 'Música', color: 'A1B2C3' }).success).toBe(false)
    expect(categoryInputSchema.safeParse({ name: 'Música', color: '#GGGGGG' }).success).toBe(false)
  })
})

describe('settingsPatchSchema', () => {
  it('accepts partial settings', () => {
    expect(settingsPatchSchema.safeParse({ userName: 'Ana' }).success).toBe(true)
    expect(
      settingsPatchSchema.safeParse({
        workStart: '08:00',
        workEnd: '17:00',
        defaultDuration: 45,
        weekStartsOn: 'sunday'
      }).success
    ).toBe(true)
  })

  it('rejects invalid workdays and durations', () => {
    expect(
      settingsPatchSchema.safeParse({ workStart: '18:00', workEnd: '08:00' }).success
    ).toBe(false)
    expect(settingsPatchSchema.safeParse({ defaultDuration: 4 }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ defaultDuration: 481 }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ weekStartsOn: 'friday' }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ userName: 'a'.repeat(61) }).success).toBe(false)
  })
})

describe('backupSchema', () => {
  const validBackup = {
    app: 'LifeSync',
    version: 1,
    exportedAt: '2026-11-05T10:00:00.000Z',
    categories: [
      {
        id: 1,
        name: 'Personal',
        color: '#7451A6',
        isDefault: true,
        createdAt: '2026-11-05T10:00:00.000Z'
      }
    ],
    activities: [
      {
        id: 1,
        title: 'Estudiar',
        description: '',
        date: '2026-11-05',
        startTime: '08:00',
        endTime: '09:00',
        duration: 60,
        categoryId: 1,
        priority: 'alta',
        status: 'pendiente',
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z'
      }
    ],
    settings: { user_name: 'Ana' }
  }

  it('accepts a well-formed backup', () => {
    expect(backupSchema.safeParse(validBackup).success).toBe(true)
  })

  it('rejects backups from other applications or malformed contents', () => {
    expect(backupSchema.safeParse({ ...validBackup, app: 'OtraApp' }).success).toBe(false)
    expect(backupSchema.safeParse({ ...validBackup, categories: [] }).success).toBe(false)
    expect(
      backupSchema.safeParse({
        ...validBackup,
        activities: [{ ...validBackup.activities[0], endTime: '07:00' }]
      }).success
    ).toBe(false)
    expect(
      backupSchema.safeParse({
        ...validBackup,
        activities: [{ ...validBackup.activities[0], date: '2026-02-30' }]
      }).success
    ).toBe(false)
  })
})
