import type { ReactElement } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Activity } from '@shared/types'
import { Modal } from './Modal'
import { CategoryPill } from './ActivityBadges'

interface ConflictDialogProps {
  open: boolean
  conflicts: Activity[]
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConflictDialog({
  open,
  conflicts,
  busy,
  onCancel,
  onConfirm
}: ConflictDialogProps): ReactElement | null {
  return (
    <Modal
      open={open}
      title="Conflicto de horario"
      subtitle="La actividad se superpone con otras ya programadas."
      size="sm"
      onClose={busy ? () => undefined : onCancel}
    >
      <div className="conflict-dialog-content">
        <div className="conflict-callout">
          <AlertTriangle size={24} />
          <p>
            Se {conflicts.length === 1 ? 'encontró 1 actividad' : `encontraron ${conflicts.length} actividades`}{' '}
            en el mismo intervalo. Puedes volver atrás y ajustar el horario o guardar de todas formas.
          </p>
        </div>
        <ul className="conflict-list">
          {conflicts.map((activity) => (
            <li key={activity.id}>
              <div className="conflict-time">
                {activity.startTime} – {activity.endTime}
              </div>
              <div className="conflict-detail">
                <strong>{activity.title}</strong>
                <CategoryPill category={activity.category} subtle />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="modal-footer inline-footer">
        <button type="button" className="button ghost" onClick={onCancel} disabled={busy}>
          Volver y ajustar
        </button>
        <button type="button" className="button warning" onClick={onConfirm} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar de todas formas'}
        </button>
      </div>
    </Modal>
  )
}
