import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/constants'
import type { IpcResult, LifeSyncAPI } from '@shared/types'

function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>
}

const api: LifeSyncAPI = {
  activities: {
    list: (filters) => invoke(IPC.activitiesList, filters),
    get: (id) => invoke(IPC.activitiesGet, id),
    create: (input, force) => invoke(IPC.activitiesCreate, input, force),
    update: (id, input, force) => invoke(IPC.activitiesUpdate, id, input, force),
    remove: (id) => invoke(IPC.activitiesDelete, id),
    setStatus: (id, status) => invoke(IPC.activitiesSetStatus, id, status),
    checkConflicts: (input, excludeId) =>
      invoke(IPC.activitiesCheckConflicts, input, excludeId)
  },
  categories: {
    list: () => invoke(IPC.categoriesList),
    create: (input) => invoke(IPC.categoriesCreate, input),
    update: (id, input) => invoke(IPC.categoriesUpdate, id, input),
    remove: (id, reassignTo) => invoke(IPC.categoriesDelete, id, reassignTo)
  },
  availability: {
    getDay: (date) => invoke(IPC.availabilityGetDay, date),
    getRange: (from, days) => invoke(IPC.availabilityGetRange, from, days)
  },
  dashboard: {
    getStats: () => invoke(IPC.dashboardGetStats)
  },
  settings: {
    get: () => invoke(IPC.settingsGet),
    update: (patch) => invoke(IPC.settingsUpdate, patch)
  },
  backup: {
    export: () => invoke(IPC.backupExport),
    import: () => invoke(IPC.backupImport),
    getInfo: () => invoke(IPC.backupGetInfo)
  },
  app: {
    getInfo: () => invoke(IPC.appGetInfo),
    openDataFolder: () => invoke(IPC.appOpenDataFolder)
  }
}

contextBridge.exposeInMainWorld('lifesync', api)
