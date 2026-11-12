export type Priority = 'alta' | 'media' | 'baja'
export type ActivityStatus = 'pendiente' | 'completada'
export type WeekStart = 'monday' | 'sunday'

export interface Category {
  id: number
  name: string
  color: string
  isDefault: boolean
  createdAt: string
  activityCount: number
}

export interface Activity {
  id: number
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  duration: number
  categoryId: number
  priority: Priority
  status: ActivityStatus
  createdAt: string
  updatedAt: string
  category: Category
  conflictIds: number[]
}

export interface ActivityInput {
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  categoryId: number
  priority: Priority
  status: ActivityStatus
}

export interface ActivityFilters {
  search?: string
  categoryId?: number
  priority?: Priority | ''
  status?: ActivityStatus | ''
  from?: string
  to?: string
  sort?: 'asc' | 'desc'
}

export interface ConflictCheck {
  conflicts: Activity[]
}

export interface BusyInterval {
  activityId: number
  title: string
  startTime: string
  endTime: string
  categoryColor: string
  status: ActivityStatus
}

export interface FreeSlot {
  start: string
  end: string
  duration: number
}

export interface DayAvailability {
  date: string
  workStart: string
  workEnd: string
  busy: BusyInterval[]
  free: FreeSlot[]
  busyMinutes: number
  freeMinutes: number
  occupancy: number
}

export interface RangeAvailability {
  date: string
  freeMinutes: number
  busyMinutes: number
  occupancy: number
}

export interface WeekBar {
  date: string
  label: string
  count: number
}

export interface CategoryCount {
  categoryId: number
  name: string
  color: string
  count: number
}

export interface DashboardStats {
  total: number
  pending: number
  completed: number
  highPriority: number
  todayCount: number
  todayPending: number
  completionRate: number
  upcoming: Activity[]
  todayActivities: Activity[]
  weekBars: WeekBar[]
  byCategory: CategoryCount[]
  conflictCount: number
}

export interface Settings {
  userName: string
  workStart: string
  workEnd: string
  defaultDuration: number
  weekStartsOn: WeekStart
}

export interface AppInfo {
  appVersion: string
  electronVersion: string
  nodeVersion: string
  chromeVersion: string
  dbPath: string
  userDataPath: string
}

export interface BackupExportResult {
  path: string
}

export interface BackupImportResult {
  imported: boolean
  activities: number
  categories: number
}

export interface BackupInfo {
  backupsDir: string
  lastBackupPath: string | null
  lastBackupAt: string | null
}

export interface BackupData {
  app: 'LifeSync'
  version: number
  exportedAt: string
  categories: Array<{
    id: number
    name: string
    color: string
    isDefault: boolean
    createdAt: string
  }>
  activities: Array<{
    id: number
    title: string
    description: string
    date: string
    startTime: string
    endTime: string
    duration: number
    categoryId: number
    priority: Priority
    status: ActivityStatus
    createdAt: string
    updatedAt: string
  }>
  settings: Record<string, string>
}

export interface IpcError {
  code: string
  message: string
  details?: unknown
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }

export interface LifeSyncAPI {
  activities: {
    list(filters?: ActivityFilters): Promise<IpcResult<Activity[]>>
    get(id: number): Promise<IpcResult<Activity>>
    create(input: ActivityInput, force?: boolean): Promise<IpcResult<Activity>>
    update(id: number, input: ActivityInput, force?: boolean): Promise<IpcResult<Activity>>
    remove(id: number): Promise<IpcResult<{ deleted: true }>>
    setStatus(id: number, status: ActivityStatus): Promise<IpcResult<Activity>>
    checkConflicts(input: ActivityInput, excludeId?: number): Promise<IpcResult<ConflictCheck>>
  }
  categories: {
    list(): Promise<IpcResult<Category[]>>
    create(input: { name: string; color: string }): Promise<IpcResult<Category>>
    update(id: number, input: { name: string; color: string }): Promise<IpcResult<Category>>
    remove(id: number, reassignTo?: number): Promise<IpcResult<{ deleted: true }>>
  }
  availability: {
    getDay(date: string): Promise<IpcResult<DayAvailability>>
    getRange(from: string, days?: number): Promise<IpcResult<RangeAvailability[]>>
  }
  dashboard: {
    getStats(): Promise<IpcResult<DashboardStats>>
  }
  settings: {
    get(): Promise<IpcResult<Settings>>
    update(patch: Partial<Settings>): Promise<IpcResult<Settings>>
  }
  backup: {
    export(): Promise<IpcResult<BackupExportResult | null>>
    import(): Promise<IpcResult<BackupImportResult | null>>
    getInfo(): Promise<IpcResult<BackupInfo>>
  }
  app: {
    getInfo(): Promise<IpcResult<AppInfo>>
    openDataFolder(): Promise<IpcResult<{ opened: boolean }>>
  }
}
