export const IPC = {
  activitiesList: 'activities:list',
  activitiesGet: 'activities:get',
  activitiesCreate: 'activities:create',
  activitiesUpdate: 'activities:update',
  activitiesDelete: 'activities:delete',
  activitiesSetStatus: 'activities:set-status',
  activitiesCheckConflicts: 'activities:check-conflicts',
  categoriesList: 'categories:list',
  categoriesCreate: 'categories:create',
  categoriesUpdate: 'categories:update',
  categoriesDelete: 'categories:delete',
  availabilityGetDay: 'availability:get-day',
  availabilityGetRange: 'availability:get-range',
  dashboardGetStats: 'dashboard:get-stats',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  backupExport: 'backup:export',
  backupImport: 'backup:import',
  backupGetInfo: 'backup:get-info',
  appGetInfo: 'app:get-info',
  appOpenDataFolder: 'app:open-data-folder'
} as const

export const DEFAULT_CATEGORIES = [
  { name: 'Personal', color: '#7451A6' },
  { name: 'Académica', color: '#4F86C6' },
  { name: 'Laboral', color: '#D97706' },
  { name: 'Salud', color: '#2E9E6B' },
  { name: 'Otros', color: '#777777' }
] as const

export const DEFAULT_SETTINGS = {
  userName: '',
  workStart: '07:00',
  workEnd: '22:00',
  defaultDuration: 60,
  weekStartsOn: 'monday' as const
}

export const PRIORITY_LABELS = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja'
} as const

export const STATUS_LABELS = {
  pendiente: 'Pendiente',
  completada: 'Completada'
} as const

export const COLOR_PRESETS = [
  '#7451A6',
  '#4F86C6',
  '#D97706',
  '#2E9E6B',
  '#B23A48',
  '#C9892B',
  '#777777',
  '#8E44AD',
  '#2C7A7B',
  '#A0522D'
] as const
