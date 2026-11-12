import type { ReactElement } from 'react'
import { Loader2 } from 'lucide-react'
import { useActivityDialog } from '../context/ActivityDialogContext'
import { useDataVersion } from '../context/DataVersionContext'
import { useCategories } from '../hooks/useCategories'
import { useSettings } from '../hooks/useSettings'
import { ActivityForm } from './ActivityForm'
import { ActivityDetail } from './ActivityDetail'
import { Modal } from './Modal'

export function ActivityDialogHost(): ReactElement | null {
  const { state, close, openEdit, updateDetail } = useActivityDialog()
  const { bump } = useDataVersion()
  const categories = useCategories()
  const settings = useSettings()

  if (state.type === 'closed') return null

  if (state.type === 'detail') {
    return (
      <ActivityDetail
        key={state.activity.id}
        open
        activity={state.activity}
        onClose={close}
        onEdit={openEdit}
        onChanged={(activity) => {
          updateDetail(activity)
          bump()
        }}
        onDeleted={() => {
          bump()
          close()
        }}
      />
    )
  }

  if (!categories.data || !settings.data) {
    const error = categories.error ?? settings.error
    return (
      <Modal
        open
        title={state.type === 'edit' ? 'Editar actividad' : 'Nueva actividad'}
        onClose={close}
        size="sm"
      >
        <div className="dialog-loading">
          {error ? (
            <>
              <p>{error}</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  categories.reload()
                  settings.reload()
                }}
              >
                Reintentar
              </button>
            </>
          ) : (
            <p><Loader2 size={18} className="spin" /> Preparando formulario…</p>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <ActivityForm
      key={state.type === 'edit' ? `edit-${state.activity.id}` : 'create'}
      open
      initial={state.type === 'edit' ? state.activity : null}
      prefill={state.type === 'create' ? state.prefill : undefined}
      categories={categories.data}
      settings={settings.data}
      onClose={close}
      onSaved={() => {
        bump()
        close()
      }}
    />
  )
}
