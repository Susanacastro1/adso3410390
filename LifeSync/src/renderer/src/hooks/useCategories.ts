import { getApi } from '../services/api'
import { useApiData } from './useApiData'

export function useCategories() {
  return useApiData(() => getApi().categories.list())
}
