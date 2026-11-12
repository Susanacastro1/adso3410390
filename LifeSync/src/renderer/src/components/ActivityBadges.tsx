import type { ReactElement } from 'react'
import { AlertTriangle, ArrowDown, CheckCircle2, Circle, Flag } from 'lucide-react'
import type { ActivityStatus, Category, Priority } from '@shared/types'
import { hexToRgba } from '../utils/colors'

export function CategoryPill({
  category,
  subtle = false
}: {
  category: Category
  subtle?: boolean
}): ReactElement {
  return (
    <span
      className={`category-pill ${subtle ? 'subtle' : ''}`}
      style={{
        backgroundColor: subtle ? hexToRgba(category.color, 0.12) : category.color,
        color: subtle ? category.color : undefined
      }}
    >
      <span className="category-dot" style={{ backgroundColor: category.color }} />
      {category.name}
    </span>
  )
}

const PRIORITY_META: Record<
  Priority,
  { label: string; icon: ReactElement; className: string }
> = {
  alta: {
    label: 'Alta',
    icon: <AlertTriangle size={13} />,
    className: 'priority-alta'
  },
  media: {
    label: 'Media',
    icon: <Flag size={13} />,
    className: 'priority-media'
  },
  baja: {
    label: 'Baja',
    icon: <ArrowDown size={13} />,
    className: 'priority-baja'
  }
}

export function PriorityBadge({ priority }: { priority: Priority }): ReactElement {
  const meta = PRIORITY_META[priority]
  return (
    <span className={`priority-badge ${meta.className}`}>
      {meta.icon}
      {meta.label}
    </span>
  )
}

export function StatusBadge({ status }: { status: ActivityStatus }): ReactElement {
  return (
    <span className={`status-badge ${status === 'completada' ? 'is-completed' : ''}`}>
      {status === 'completada' ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      {status === 'completada' ? 'Completada' : 'Pendiente'}
    </span>
  )
}

export function ConflictBadge({ count }: { count: number }): ReactElement | null {
  if (count <= 0) return null
  return (
    <span
      className="conflict-badge"
      title={`${count} ${count === 1 ? 'conflicto de horario' : 'conflictos de horario'}`}
    >
      <AlertTriangle size={13} />
      {count === 1 ? '1 conflicto' : `${count} conflictos`}
    </span>
  )
}
