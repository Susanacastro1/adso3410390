import { app, BrowserWindow, Menu, session } from 'electron'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  backupBeforeStartup,
  closeDatabase,
  initDatabase
} from './database/connection'
import { registerIpcHandlers } from './ipc/registerHandlers'
import { createMainWindow } from './window'

app.setName('LifeSync')

if (process.env.LIFESYNC_USER_DATA) {
  app.setPath('userData', process.env.LIFESYNC_USER_DATA)
}

function logFatal(context: string, error: unknown): void {
  try {
    const logsDir = join(app.getPath('userData'), 'logs')
    mkdirSync(logsDir, { recursive: true })
    const detail = error instanceof Error ? `${error.stack ?? error.message}` : String(error)
    appendFileSync(
      join(logsDir, 'main.log'),
      `[${new Date().toISOString()}] ${context}: ${detail}\n`,
      'utf8'
    )
  } catch {
    // El registro de errores nunca debe provocar otro fallo.
  }
}

process.on('uncaughtException', (error) => {
  logFatal('uncaughtException', error)
  console.error('Error no controlado en el proceso principal:', error)
})

process.on('unhandledRejection', (reason) => {
  logFatal('unhandledRejection', reason)
  console.error('Promesa rechazada sin manejar:', reason)
})

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    const userData = app.getPath('userData')
    const dbPath = join(userData, 'lifesync.db')
    backupBeforeStartup(dbPath, join(userData, 'backups'))

    initDatabase(dbPath)
    registerIpcHandlers()

    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false)
    })

    Menu.setApplicationMenu(null)
    mainWindow = createMainWindow()

    mainWindow.on('closed', () => {
      mainWindow = null
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      }
    })
  }).catch((error: unknown) => {
    logFatal('startup', error)
    console.error('No se pudo iniciar LifeSync:', error)
    app.quit()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    closeDatabase()
  })
}
