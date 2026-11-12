import { useEffect, useState, type ReactElement } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Pencil,
  RotateCcw,
  Timer,
  Trash2
} from 'lucide-react'
import { formatDuration } from '@shared/domain/time'
import type { Activity, ActivityInput } from '@shared/types'
import { errorMessage, getApi, unwrap } from '../services/api'
import { useToast } from './Toast'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import { CategoryPill, ConflictBadge, PriorityBadge, StatusBadge } from './ActivityBadges'
import { formatLongDate, formatTimestamp } from '../utils/date'

interface ActivityDetailProps {
  open: boolean
  activity: Activity | null
  onClose: () => void
  onEdit: (activity: Activity) => void
  onChanged: (activity: Activity) => void
  onDeleted: () => void
}

function toInput(activity: Activity): ActivityInput {
  return {
    title: activity.title,
    description: activity.description,
    date: activity.date,
    startTime: activity.startTime,
    endTime: activity.endTime,
    categoryId: activity.categoryId,
    priority: activity.priority,
    status: activity.status
  }
}

export function ActivityDetail({
  open,
  activity: initialActivity,
  onClose,
  onEdit,
  onChanged,
  onDeleted
}: ActivityDetailProps): ReactElement | null {
  const toast = useToast()
  const [activity, setActivity] = useState<Activity | null>(initialActivity)
  const [conflicts, setConflicts] = useState<Activity[]>([])
  const [loadingConflicts, setLoadingConflicts] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    setActivity(initialActivity)
    if (!initialActivity || !open) {
      setConflicts([])
      return undefined
    }

    let active = true
    setLoadingConflicts(true)
    unwrap(getApi().activities.checkConflicts(toInput(initialActivity), initialActivity.id))
      .then((result) => {
        if (active) setConflicts(result.conflicts)
      })
      .catch(() => {
        if (active) setConflicts([])
      })
      .finally(() => {
        if (active) setLoadingConflicts(false)
      })

    return () => {
      active = false
    }
  }, [initialActivity, open])

  if (!activity) return null

  async function toggleStatus(): Promise<void> {
    if (!activity || busy) return
    setBusy(true)
    try {
      const next = activity.status === 'pendiente' ? 'completada' : 'pendiente'
      const updated = await unwrap(getApi().activities.setStatus(activity.id, next))
      setActivity(updated)
      onChanged(updated)
      toast.success(
        next === 'completada'
          ? 'Actividad marcada como completada.'
          : 'Actividad marcada como pendiente.'
      )
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    if (!activity || busy) return
    setBusy(true)
    try {
      await unwrap(getApi().activities.remove(activity.id))
      toast.success('Actividad eliminada correctamente.')
      setConfirmingDelete(false)
      onDeleted()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        title={activity.title}
        subtitle="Detalle de la actividad"
        onClose={() => {
          if (confirmingDelete) {
            setConfirmingDelete(false)
            return
          }
          onClose()
        }}
        footer={
          <>
            <button
              type="button"
              className="button ghost"
              onClick={() => void toggleStatus()}
              disabled={busy}
            >
              {activity.status === 'completada' ? <RotateCcw size={17} /> : <CheckCircle2 size={17} />}
              {activity.status === 'completada' ? 'Marcar pendiente' : 'Marcar completada'}
            </button>
            <div className="footer-spacer" />
            <button
              type="button"
              className="button danger-ghost"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              <Trash2 size={17} /> Eliminar
            </button>
            <button type="button" className="button secondary" onClick={() => onEdit(activity)}>
              <Pencil size={17} /> Editar
            </button>
          </>
        }
      >
        <div className="detail-content">
          <div className="detail-badges">
            <CategoryPill category={activity.category} />
            <PriorityBadge priority={activity.priority} />
            <StatusBadge status={activity.status} />
            <ConflictBadge count={conflicts.length} />
          </div>

          {activity.description && (
            <p className="detail-description">{activity.description}</p>
          )}

          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-icon"><CalendarDays size={18} /></span>
              <div>
                <small>Fecha</small>
                <strong>{formatLongDate(activity.date)}</strong>
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-icon"><Clock3 size={18} /></span>
              <div>
                <small>Horario</small>
                <strong>{activity.startTime} – {activity.endTime}</strong>
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-icon"><Timer size={18} /></span>
              <div>
                <small>Duración</small>
                <strong>{formatDuration(activity.duration)}</strong>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h3>
              <AlertTriangle size={16} />
              Conflictos de horario
            </h3>
            {loadingConflicts ? (
              <p className="detail-muted"><Loader2 size={15} className="spin" /> Comprobando conflictos…</p>
            ) : conflicts.length === 0 ? (
              <p className="detail-muted">Sin conflictos. El horario está libre.</p>
            ) : (
              <ul className="conflict-list compact">
                {conflicts.map((conflict) => (
                  <li key={conflict.id}>
                    <div className="conflict-time">{conflict.startTime} – {conflict.endTime}</div>
                    <div className="conflict-detail">
                      <strong>{conflict.title}</strong>
                      <CategoryPill category={conflict.category} subtle />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="detail-timestamps">
            <span>Creada: {formatTimestamp(activity.createdAt)}</span>
            <span>Actualizada: {formatTimestamp(activity.updatedAt)}</span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmingDelete}
        title="Eliminar actividad"
        message={`¿Seguro que quieres eliminar “${activity.title}”? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        busy={busy}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => void remove()}
      />
    </>
  )
}
