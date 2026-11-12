import { getApi } from '../services/api'
import { useApiData } from './useApiData'

export function useSettings() {
  return useApiData(() => getApi().settings.get())
}
