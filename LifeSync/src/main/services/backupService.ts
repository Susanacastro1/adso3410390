import type { Database } from 'better-sqlite3'
import { BrowserWindow, dialog, type MessageBoxOptions, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { calculateDuration, todayISO } from '@shared/domain/time'
import { backupSchema } from '@shared/schemas'
import type {
  BackupData,
  BackupImportResult,
  BackupInfo,
  Settings
} from '@shared/types'
import { getDbPath } from '../database/connection'
import { AppError } from '../errors'
import { listActivities } from '../repositories/activitiesRepository'
import { ensureFallbackCategory, listCategories } from '../repositories/categoriesRepository'
import { getSettingsRecord, saveSettings } from '../repositories/settingsRepository'

function showSave(parent: BrowserWindow | null, options: SaveDialogOptions) {
  return parent ? dialog.showSaveDialog(parent, options) : dialog.showSaveDialog(options)
}

function showOpen(parent: BrowserWindow | null, options: OpenDialogOptions) {
  return parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options)
}

function showMessage(parent: BrowserWindow | null, options: MessageBoxOptions) {
  return parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options)
}

function backupsDirectory(): string {
  return join(dirname(getDbPath()), 'backups')
}

function backupStamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19)
}

function pruneBackups(directory: string): void {
  try {
    const files = readdirSync(directory)
      .filter((name) => name.startsWith('lifesync-') && name.endsWith('.db'))
      .map((name) => ({ name, time: statSync(join(directory, name)).mtimeMs }))
      .sort((a, b) => b.time - a.time)

    for (const old of files.slice(10)) {
      try {
        unlinkSync(join(directory, old.name))
      } catch {
        // La limpieza no debe interrumpir la operación principal.
      }
    }
  } catch {
    // La carpeta puede no existir todavía.
  }
}

function copyBeforeImport(db: Database): void {
  try {
    db.pragma('wal_checkpoint(FULL)')
    const directory = backupsDirectory()
    mkdirSync(directory, { recursive: true })
    copyFileSync(getDbPath(), join(directory, `lifesync-preimport-${backupStamp()}.db`))
    pruneBackups(directory)
  } catch (error) {
    console.error('No se pudo crear la copia previa a la importación:', error)
  }
}

export function getBackupInfo(): BackupInfo {
  const directory = backupsDirectory()
  if (!existsSync(directory)) {
    return { backupsDir: directory, lastBackupPath: null, lastBackupAt: null }
  }

  try {
    const files = readdirSync(directory)
      .filter((name) => name.startsWith('lifesync-') && name.endsWith('.db'))
      .map((name) => ({ name, time: statSync(join(directory, name)).mtimeMs }))
      .sort((a, b) => b.time - a.time)

    const latest = files[0]
    return {
      backupsDir: directory,
      lastBackupPath: latest ? join(directory, latest.name) : null,
      lastBackupAt: latest ? new Date(latest.time).toISOString() : null
    }
  } catch {
    return { backupsDir: directory, lastBackupPath: null, lastBackupAt: null }
  }
}

export async function exportBackup(
  db: Database,
  parent: BrowserWindow | null
): Promise<{ path: string } | null> {
  const result = await showSave(parent, {
    title: 'Exportar copia de seguridad',
    defaultPath: `LifeSync-respaldo-${todayISO()}.json`,
    filters: [{ name: 'Copia de seguridad LifeSync', extensions: ['json'] }]
  })

  if (result.canceled || !result.filePath) return null

  const data: BackupData = {
    app: 'LifeSync',
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: listCategories(db).map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      isDefault: category.isDefault,
      createdAt: category.createdAt
    })),
    activities: listActivities(db, {}).map((activity) => ({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      date: activity.date,
      startTime: activity.startTime,
      endTime: activity.endTime,
      duration: activity.duration,
      categoryId: activity.categoryId,
      priority: activity.priority,
      status: activity.status,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt
    })),
    settings: getSettingsRecord(db)
  }

  writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8')
  return { path: result.filePath }
}

export async function importBackup(
  db: Database,
  parent: BrowserWindow | null
): Promise<BackupImportResult | null> {
  const selection = await showOpen(parent, {
    title: 'Importar copia de seguridad',
    properties: ['openFile'],
    filters: [{ name: 'Copia de seguridad LifeSync', extensions: ['json'] }]
  })

  if (selection.canceled || selection.filePaths.length === 0) return null

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(selection.filePaths[0], 'utf8'))
  } catch {
    throw new AppError('IMPORT_INVALID', 'El archivo no contiene JSON válido')
  }

  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError('IMPORT_INVALID', 'El archivo no es una copia de seguridad válida de LifeSync', {
      issues: parsed.error.issues.slice(0, 8)
    })
  }

  const backup = parsed.data
  const confirmation = await showMessage(parent, {
    type: 'warning',
    title: 'Importar copia de seguridad',
    message: '¿Reemplazar todos los datos actuales?',
    detail: `Se importarán ${backup.activities.length} actividades y ${backup.categories.length} categorías. Los datos actuales serán reemplazados. Se creó una copia automática antes de abrir la aplicación.`,
    buttons: ['Importar y reemplazar', 'Cancelar'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  })

  if (confirmation.response !== 0) return null

  copyBeforeImport(db)

  const normalizedSettings: Settings = {
    userName: backup.settings.user_name ?? DEFAULT_SETTINGS.userName,
    workStart: backup.settings.work_start ?? DEFAULT_SETTINGS.workStart,
    workEnd: backup.settings.work_end ?? DEFAULT_SETTINGS.workEnd,
    defaultDuration:
      Number.parseInt(
        backup.settings.default_duration ?? String(DEFAULT_SETTINGS.defaultDuration),
        10
      ) || DEFAULT_SETTINGS.defaultDuration,
    weekStartsOn: backup.settings.week_starts_on === 'sunday' ? 'sunday' : 'monday'
  }

  try {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM activities').run()
      db.prepare('DELETE FROM categories').run()

      const insertCategory = db.prepare(
        'INSERT INTO categories (id, name, color, is_default, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      for (const category of backup.categories) {
        insertCategory.run(
          category.id,
          category.name,
          category.color,
          category.isDefault ? 1 : 0,
          category.createdAt
        )
      }

      const fallback = ensureFallbackCategory(db)
      const validIds = new Set(
        (db.prepare('SELECT id FROM categories').all() as Array<{ id: number }>).map((row) => row.id)
      )

      const insertActivity = db.prepare(
        `INSERT INTO activities
          (id, title, description, date, start_time, end_time, duration, category_id, priority, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const activity of backup.activities) {
        const categoryId = validIds.has(activity.categoryId) ? activity.categoryId : fallback.id
        insertActivity.run(
          activity.id,
          activity.title,
          activity.description,
          activity.date,
          activity.startTime,
          activity.endTime,
          calculateDuration(activity.startTime, activity.endTime),
          categoryId,
          activity.priority,
          activity.status,
          activity.createdAt,
          activity.updatedAt
        )
      }

      saveSettings(db, normalizedSettings)
    })
    transaction()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al importar'
    throw new AppError('IMPORT_INVALID', `No se pudo importar la copia: ${message}`)
  }

  return {
    imported: true,
    activities: backup.activities.length,
    categories: backup.categories.length
  }
}
