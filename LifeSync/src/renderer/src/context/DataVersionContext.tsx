import { createContext, useCallback, useContext, useMemo, useState, type ReactElement, type ReactNode } from 'react'

interface DataVersionValue {
  version: number
  bump: () => void
}

const DataVersionContext = createContext<DataVersionValue>({
  version: 0,
  bump: () => undefined
})

export function DataVersionProvider({ children }: { children: ReactNode }): ReactElement {
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((current) => current + 1), [])
  const value = useMemo(() => ({ version, bump }), [version, bump])
  return <DataVersionContext.Provider value={value}>{children}</DataVersionContext.Provider>
}

export function useDataVersion(): DataVersionValue {
  return useContext(DataVersionContext)
}
