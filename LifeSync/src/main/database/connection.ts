import Database from 'better-sqlite3'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { migrate, seedInitialData } from './schema'

let instance: Database.Database | null = null
let instancePath = ''

export function createDatabase(dbPath: string): Database.Database {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true })
  }

  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')

  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
  }

  migrate(db)
  seedInitialData(db)
  return db
}

export function initDatabase(dbPath: string): Database.Database {
  if (instance) return instance
  instance = createDatabase(dbPath)
  instancePath = dbPath
  return instance
}

export function getDb(): Database.Database {
  if (!instance) {
    throw new Error('La base de datos no está inicializada')
  }
  return instance
}

export function getDbPath(): string {
  return instancePath
}

export function closeDatabase(): void {
  if (instance) {
    instance.close()
    instance = null
    instancePath = ''
  }
}

export function backupBeforeStartup(dbPath: string, backupsDir: string): string | null {
  if (!existsSync(dbPath)) return null

  try {
    mkdirSync(backupsDir, { recursive: true })
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19)
    const destination = join(backupsDir, `lifesync-${stamp}.db`)
    copyFileSync(dbPath, destination)

    const backups = readdirSync(backupsDir)
      .filter((name) => name.startsWith('lifesync-') && name.endsWith('.db'))
      .map((name) => ({ name, time: statSync(join(backupsDir, name)).mtimeMs }))
      .sort((a, b) => b.time - a.time)

    for (const old of backups.slice(10)) {
      try {
        unlinkSync(join(backupsDir, old.name))
      } catch {
        // La limpieza de copias antiguas no debe impedir el arranque.
      }
    }

    return destination
  } catch (error) {
    console.error('No se pudo crear la copia de seguridad automática:', error)
    return null
  }
}
