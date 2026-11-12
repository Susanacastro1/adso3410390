import { useEffect, useRef, useState, type DependencyList } from 'react'
import type { IpcResult } from '@shared/types'
import { errorMessage, unwrap } from '../services/api'
import { useDataVersion } from '../context/DataVersionContext'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useApiData<T>(
  load: () => Promise<IpcResult<T>>,
  deps: DependencyList = []
): ApiState<T> {
  const { version } = useDataVersion()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    unwrap(loadRef.current())
      .then((result) => {
        if (active) setData(result)
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, tick])

  return {
    data,
    loading,
    error,
    reload: () => setTick((current) => current + 1)
  }
}
