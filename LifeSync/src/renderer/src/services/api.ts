import type { IpcResult, LifeSyncAPI } from '@shared/types'

export class ApiError extends Error {
  code: string
  details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

export function getApi(): LifeSyncAPI {
  if (!window.lifesync) {
    throw new ApiError(
      'API_UNAVAILABLE',
      'La API local de LifeSync no está disponible. Abre la aplicación desde Electron.'
    )
  }
  return window.lifesync
}

export async function unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) {
    throw new ApiError(result.error.code, result.error.message, result.error.details)
  }
  return result.data
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Ocurrió un error inesperado'
}
