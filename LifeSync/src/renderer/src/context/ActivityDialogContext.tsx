import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import type { Activity, ActivityInput } from '@shared/types'

type DialogState =
  | { type: 'closed' }
  | { type: 'create'; prefill?: Partial<ActivityInput> }
  | { type: 'edit'; activity: Activity }
  | { type: 'detail'; activity: Activity }

interface ActivityDialogValue {
  state: DialogState
  openCreate: (prefill?: Partial<ActivityInput>) => void
  openEdit: (activity: Activity) => void
  openDetail: (activity: Activity) => void
  updateDetail: (activity: Activity) => void
  close: () => void
}

const ActivityDialogContext = createContext<ActivityDialogValue>({
  state: { type: 'closed' },
  openCreate: () => undefined,
  openEdit: () => undefined,
  openDetail: () => undefined,
  updateDetail: () => undefined,
  close: () => undefined
})

export function ActivityDialogProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, setState] = useState<DialogState>({ type: 'closed' })

  const openCreate = useCallback((prefill?: Partial<ActivityInput>) => {
    setState({ type: 'create', prefill })
  }, [])

  const openEdit = useCallback((activity: Activity) => {
    setState({ type: 'edit', activity })
  }, [])

  const openDetail = useCallback((activity: Activity) => {
    setState({ type: 'detail', activity })
  }, [])

  const updateDetail = useCallback((activity: Activity) => {
    setState((current) =>
      current.type === 'detail' ? { type: 'detail', activity } : current
    )
  }, [])

  const close = useCallback(() => setState({ type: 'closed' }), [])

  const value = useMemo<ActivityDialogValue>(
    () => ({ state, openCreate, openEdit, openDetail, updateDetail, close }),
    [state, openCreate, openEdit, openDetail, updateDetail, close]
  )

  return (
    <ActivityDialogContext.Provider value={value}>{children}</ActivityDialogContext.Provider>
  )
}

export function useActivityDialog(): ActivityDialogValue {
  return useContext(ActivityDialogContext)
}
