import { z } from 'zod'
import { isValidDateString, isValidTimeString } from './domain/time'

const timeSchema = z.string().refine(isValidTimeString, 'Hora inválida (use HH:MM)')
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (use AAAA-MM-DD)')
  .refine(isValidDateString, 'La fecha no existe')

export const activityInputSchema = z
  .object({
    title: z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres'),
    description: z.string().max(1000, 'Máximo 1000 caracteres').default(''),
    date: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    categoryId: z.number().int().positive('Seleccione una categoría'),
    priority: z.enum(['alta', 'media', 'baja']),
    status: z.enum(['pendiente', 'completada'])
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'La hora de fin debe ser posterior a la hora de inicio',
    path: ['endTime']
  })

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(30, 'Máximo 30 caracteres'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hexadecimal inválido')
})

export const settingsPatchSchema = z
  .object({
    userName: z.string().max(60, 'Máximo 60 caracteres'),
    workStart: timeSchema,
    workEnd: timeSchema,
    defaultDuration: z.number().int().min(5).max(480),
    weekStartsOn: z.enum(['monday', 'sunday'])
  })
  .partial()
  .refine(
    (data) => {
      if (!data.workStart || !data.workEnd) return true
      return data.workEnd > data.workStart
    },
    { message: 'La jornada debe terminar después de empezar', path: ['workEnd'] }
  )

const backupCategorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  isDefault: z.boolean(),
  createdAt: z.string()
})

const backupActivitySchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1).max(120),
    description: z.string().max(1000),
    date: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    duration: z.number().int().positive(),
    categoryId: z.number().int().positive(),
    priority: z.enum(['alta', 'media', 'baja']),
    status: z.enum(['pendiente', 'completada']),
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'Hora de fin inválida',
    path: ['endTime']
  })

export const backupSchema = z.object({
  app: z.literal('LifeSync'),
  version: z.number(),
  exportedAt: z.string(),
  categories: z.array(backupCategorySchema).min(1),
  activities: z.array(backupActivitySchema),
  settings: z.record(z.string(), z.string())
})

export type ActivityInputSchema = z.infer<typeof activityInputSchema>
export type CategoryInputSchema = z.infer<typeof categoryInputSchema>
export type SettingsPatchSchema = z.infer<typeof settingsPatchSchema>
