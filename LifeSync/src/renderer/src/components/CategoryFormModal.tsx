import { useId, useRef, useState, type ReactElement } from 'react'
import { Loader2, Palette, Save, Tags } from 'lucide-react'
import type { Category } from '@shared/types'
import { COLOR_PRESETS } from '@shared/constants'
import { ApiError, errorMessage, getApi, unwrap } from '../services/api'
import { useToast } from './Toast'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import { CategoryPill } from './ActivityBadges'

interface CategoryFormModalProps {
  open: boolean
  category: Category | null
  onClose: () => void
  onSaved: () => void
}

interface Values {
  name: string
  color: string
}

export function CategoryFormModal({
  open,
  category,
  onClose,
  onSaved
}: CategoryFormModalProps): ReactElement {
  const formId = useId()
  const toast = useToast()
  const [values, setValues] = useState<Values>(() => ({
    name: category?.name ?? '',
    color: category?.color ?? COLOR_PRESETS[0]
  }))
  const baseline = useRef(JSON.stringify(values))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)

  const dirty = JSON.stringify(values) !== baseline.current

  function requestClose(): void {
    if (saving) return
    if (showDiscard) {
      setShowDiscard(false)
      return
    }
    if (dirty) setShowDiscard(true)
    else onClose()
  }

  async function submit(): Promise<void> {
    const nextErrors: Record<string, string> = {}
    const name = values.name.trim()
    if (!name) nextErrors.name = 'El nombre es obligatorio.'
    else if (name.length > 30) nextErrors.name = 'Máximo 30 caracteres.'
    if (!/^#[0-9A-Fa-f]{6}$/.test(values.color)) {
      nextErrors.color = 'Usa un color hexadecimal válido, por ejemplo #7451A6.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      const api = getApi()
      if (category) {
        await unwrap(api.categories.update(category.id, { name, color: values.color }))
        toast.success('Categoría actualizada correctamente.')
      } else {
        await unwrap(api.categories.create({ name, color: values.color }))
        toast.success('Categoría creada correctamente.')
      }
      onSaved()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'DUPLICATE_CATEGORY') {
        setErrors({ name: error.message })
      } else {
        toast.error(errorMessage(error))
      }
    } finally {
      setSaving(false)
    }
  }

  const preview: Category = {
    id: category?.id ?? 0,
    name: values.name.trim() || 'Vista previa',
    color: values.color,
    isDefault: category?.isDefault ?? false,
    createdAt: category?.createdAt ?? new Date().toISOString(),
    activityCount: category?.activityCount ?? 0
  }

  return (
    <>
      <Modal
        open={open}
        title={category ? 'Editar categoría' : 'Nueva categoría'}
        subtitle="Las categorías te ayudan a identificar tus actividades por color."
        size="sm"
        onClose={requestClose}
        footer={
          <>
            <button type="button" className="button ghost" onClick={requestClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" form={formId} className="button primary" disabled={saving}>
              {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />}
              {saving ? 'Guardando…' : category ? 'Guardar cambios' : 'Crear categoría'}
            </button>
          </>
        }
      >
        <form
          id={formId}
          className="category-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          noValidate
        >
          <div className="form-field full">
            <label htmlFor="category-name">
              <Tags size={15} /> Nombre *
            </label>
            <input
              id="category-name"
              className={`input ${errors.name ? 'has-error' : ''}`}
              value={values.name}
              maxLength={30}
              autoFocus
              placeholder="Ej. Universidad, Familia, Proyectos…"
              onChange={(event) => {
                setValues((current) => ({ ...current, name: event.target.value }))
                setErrors((current) => ({ ...current, name: '' }))
              }}
            />
            <div className="field-meta">
              {errors.name ? (
                <span className="field-error">{errors.name}</span>
              ) : (
                <span className="field-hint">Nombre único, máximo 30 caracteres.</span>
              )}
              <span className="field-counter">{values.name.length}/30</span>
            </div>
          </div>

          <div className="form-field full">
            <label htmlFor="category-color">
              <Palette size={15} /> Color *
            </label>
            <div className="color-picker-row">
              <input
                id="category-color"
                type="color"
                className="color-input"
                value={values.color}
                onChange={(event) => {
                  setValues((current) => ({ ...current, color: event.target.value }))
                  setErrors((current) => ({ ...current, color: '' }))
                }}
                aria-label="Selector de color"
              />
              <input
                className={`input ${errors.color ? 'has-error' : ''}`}
                value={values.color}
                maxLength={7}
                onChange={(event) => {
                  setValues((current) => ({ ...current, color: event.target.value }))
                  setErrors((current) => ({ ...current, color: '' }))
                }}
                aria-label="Código hexadecimal del color"
              />
            </div>
            <div className="color-presets" aria-label="Colores sugeridos">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${values.color.toLowerCase() === color.toLowerCase() ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setValues((current) => ({ ...current, color }))
                    setErrors((current) => ({ ...current, color: '' }))
                  }}
                  aria-label={`Usar color ${color}`}
                />
              ))}
            </div>
            {errors.color && <span className="field-error">{errors.color}</span>}
          </div>

          <div className="category-preview">
            <span>Vista previa</span>
            <CategoryPill category={preview} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={showDiscard}
        title="Descartar cambios"
        message="Hay cambios sin guardar en esta categoría. ¿Quieres descartarlos?"
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        danger
        onCancel={() => setShowDiscard(false)}
        onConfirm={() => {
          setShowDiscard(false)
          onClose()
        }}
      />
    </>
  )
}
