import { getApi } from '../services/api'
import { useApiData } from './useApiData'

export function useAvailability(date: string) {
  return useApiData(() => getApi().availability.getDay(date), [date])
}

export function useAvailabilityRange(from: string, days = 7) {
  return useApiData(() => getApi().availability.getRange(from, days), [from, days])
}
