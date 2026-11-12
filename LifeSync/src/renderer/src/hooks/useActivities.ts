import type { ActivityFilters } from '@shared/types'
import { getApi } from '../services/api'
import { useApiData } from './useApiData'

export function useActivities(filters: ActivityFilters = {}) {
  const key = JSON.stringify(filters)
  return useApiData(() => getApi().activities.list(filters), [key])
}
