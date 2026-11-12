import type { ReactElement } from 'react'

export function PageSkeleton({ rows = 4 }: { rows?: number }): ReactElement {
  return (
    <div className="skeleton-page" aria-label="Cargando información">
      <div className="skeleton skeleton-title" />
      <div className="skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="skeleton skeleton-card" />
        ))}
      </div>
      <div className="skeleton skeleton-block" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton skeleton-line" />
      ))}
    </div>
  )
}

export function InlineSpinner({ label = 'Cargando' }: { label?: string }): ReactElement {
  return (
    <span className="inline-spinner" role="status" aria-label={label}>
      <span className="spinner" />
      {label}
    </span>
  )
}
