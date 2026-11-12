import type { ReactElement } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
  children
}: ConfirmDialogProps): ReactElement | null {
  return (
    <Modal open={open} title={title} onClose={onCancel} size="sm">
      <div className="confirm-content">
        <div className={`confirm-icon ${danger ? 'danger' : ''}`}>
          <AlertTriangle size={28} />
        </div>
        <p>{message}</p>
        {children}
      </div>
      <div className="modal-footer inline-footer">
        <button type="button" className="button ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`button ${danger ? 'danger' : 'primary'}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Procesando…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
