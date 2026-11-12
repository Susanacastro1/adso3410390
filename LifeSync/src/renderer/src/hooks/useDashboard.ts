import { getApi } from '../services/api'
import { useApiData } from './useApiData'

export function useDashboard() {
  return useApiData(() => getApi().dashboard.getStats())
}
