import { getApi } from '../services/api'
import { useApiData } from './useApiData'

export function useAppInfo() {
  return useApiData(() => getApi().app.getInfo())
}

export function useBackupInfo() {
  return useApiData(() => getApi().backup.getInfo())
}
