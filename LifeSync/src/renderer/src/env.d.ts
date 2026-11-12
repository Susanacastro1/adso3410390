import type { LifeSyncAPI } from '@shared/types'

declare global {
  interface Window {
    lifesync: LifeSyncAPI
  }
}

export {}
