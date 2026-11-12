import { BrowserWindow, app, ipcMain, shell } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/constants'
import { isValidDateString } from '@shared/domain/time'
import {
  activityInputSchema,
  categoryInputSchema,
  settingsPatchSchema
} from '@shared/schemas'
import type {
  ActivityFilters,
  ActivityStatus,
  AppInfo,
  IpcResult,
  Settings
} from '@shared/types'
import { getDb, getDbPath } from '../database/connection'
import { AppError } from '../errors'
import {
  deleteActivity,
  getActivity
} from '../repositories/activitiesRepository'
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory
} from '../repositories/categoriesRepository'
import { getSettings, updateSettings } from '../repositories/settingsRepository'
import {
  checkConflicts,
  createWithConflicts,
  getWithConflicts,
  listWithConflicts,
  toggleStatus,
  updateWithConflicts
} from '../services/activitiesService'
import { getDayAvailability, getRangeAvailability } from '../services/availabilityService'
import { exportBackup, getBackupInfo, importBackup } from '../services/backupService'
import { getDashboardStats } from '../services/dashboardService'

const idSchema = z.number().int().positive()
const dateSchema = z.string().refine(isValidDateString, 'Fecha inválida')
const statusSchema = z.enum(['pendiente', 'completada'])
const prioritySchema = z.enum(['alta', 'media', 'baja'])
const forceSchema = z.boolean().optional()

const filtersSchema = z
  .object({
    search: z.string().max(200).optional(),
    categoryId: z.number().int().positive().optional(),
    priority: prioritySchema.or(z.literal('')).optional(),
    status: statusSchema.or(z.literal('')).optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    sort: z.enum(['asc', 'desc']).optional()
  })
  .optional()

function toErrorResult(error: unknown): IpcResult<never> {
  if (error instanceof AppError) {
    return { ok: false, error: { code: error.code, message: error.message, details: error.details } }
  }
  if (error instanceof z.ZodError) {
    const first = error.issues[0]
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: first?.message ?? 'Datos inválidos',
        details: error.issues
      }
    }
  }
  console.error('Error IPC no controlado:', error)
  const message = error instanceof Error ? error.message : 'Error interno desconocido'
  return { ok: false, error: { code: 'UNKNOWN_ERROR', message } }
}

function handleSync<T, Args extends unknown[]>(
  channel: string,
  handler: (...args: Args) => T
): void {
  ipcMain.handle(channel, (_event, ...args) => {
    try {
      return { ok: true, data: handler(...(args as Args)) }
    } catch (error) {
      return toErrorResult(error)
    }
  })
}

function handleAsync<T, Args extends unknown[]>(
  channel: string,
  handler: (...args: Args) => Promise<T>
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: await handler(...(args as Args)) }
    } catch (error) {
      return toErrorResult(error)
    }
  })
}

function ensureCategory(categoryId: number): void {
  if (!getCategory(getDb(), categoryId)) {
    throw new AppError('VALIDATION_ERROR', 'La categoría seleccionada no existe')
  }
}

export function registerIpcHandlers(): void {
  handleSync(IPC.activitiesList, (filters?: ActivityFilters) => {
    const parsed = filtersSchema.parse(filters)
    return listWithConflicts(getDb(), parsed)
  })

  handleSync(IPC.activitiesGet, (id: number) => {
    const activity = getWithConflicts(getDb(), idSchema.parse(id))
    if (!activity) throw new AppError('NOT_FOUND', 'La actividad no existe')
    return activity
  })

  handleSync(IPC.activitiesCreate, (input: unknown, force?: boolean) => {
    const data = activityInputSchema.parse(input)
    ensureCategory(data.categoryId)
    return createWithConflicts(getDb(), data, forceSchema.parse(force) ?? false)
  })

  handleSync(IPC.activitiesUpdate, (id: number, input: unknown, force?: boolean) => {
    const data = activityInputSchema.parse(input)
    ensureCategory(data.categoryId)
    const updated = updateWithConflicts(
      getDb(),
      idSchema.parse(id),
      data,
      forceSchema.parse(force) ?? false
    )
    if (!updated) throw new AppError('NOT_FOUND', 'La actividad no existe')
    return updated
  })

  handleSync(IPC.activitiesDelete, (id: number) => {
    if (!deleteActivity(getDb(), idSchema.parse(id))) {
      throw new AppError('NOT_FOUND', 'La actividad no existe')
    }
    return { deleted: true as const }
  })

  handleSync(IPC.activitiesSetStatus, (id: number, status: ActivityStatus) => {
    const updated = toggleStatus(getDb(), idSchema.parse(id), statusSchema.parse(status))
    if (!updated) throw new AppError('NOT_FOUND', 'La actividad no existe')
    return updated
  })

  handleSync(IPC.activitiesCheckConflicts, (input: unknown, excludeId?: number) => {
    const data = activityInputSchema.parse(input)
    return checkConflicts(getDb(), data, excludeId ? idSchema.parse(excludeId) : undefined)
  })

  handleSync(IPC.categoriesList, () => listCategories(getDb()))

  handleSync(IPC.categoriesCreate, (input: unknown) => {
    const data = categoryInputSchema.parse(input)
    return createCategory(getDb(), data)
  })

  handleSync(IPC.categoriesUpdate, (id: number, input: unknown) => {
    const data = categoryInputSchema.parse(input)
    return updateCategory(getDb(), idSchema.parse(id), data)
  })

  handleSync(IPC.categoriesDelete, (id: number, reassignTo?: number) => {
    deleteCategory(
      getDb(),
      idSchema.parse(id),
      reassignTo === undefined ? undefined : idSchema.parse(reassignTo)
    )
    return { deleted: true as const }
  })

  handleSync(IPC.availabilityGetDay, (date: string) => {
    return getDayAvailability(getDb(), dateSchema.parse(date))
  })

  handleSync(IPC.availabilityGetRange, (from: string, days?: number) => {
    return getRangeAvailability(getDb(), dateSchema.parse(from), days)
  })

  handleSync(IPC.dashboardGetStats, () => getDashboardStats(getDb()))

  handleSync(IPC.settingsGet, () => getSettings(getDb()))

  handleSync(IPC.settingsUpdate, (patch: Partial<Settings>) => {
    const data = settingsPatchSchema.parse(patch)
    return updateSettings(getDb(), data)
  })

  ipcMain.handle(IPC.backupExport, async (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender)
      return { ok: true, data: await exportBackup(getDb(), window) }
    } catch (error) {
      return toErrorResult(error)
    }
  })

  ipcMain.handle(IPC.backupImport, async (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender)
      return { ok: true, data: await importBackup(getDb(), window) }
    } catch (error) {
      return toErrorResult(error)
    }
  })

  handleSync(IPC.backupGetInfo, () => getBackupInfo())

  handleSync(IPC.appGetInfo, (): AppInfo => {
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      dbPath: getDbPath(),
      userDataPath: app.getPath('userData')
    }
  })

  handleAsync(IPC.appOpenDataFolder, async () => {
    const error = await shell.openPath(app.getPath('userData'))
    return { opened: error === '' }
  })
}
