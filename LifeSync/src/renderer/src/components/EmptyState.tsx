import type { ReactElement, ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  message: string
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  compact = false
}: EmptyStateProps): ReactElement {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}
