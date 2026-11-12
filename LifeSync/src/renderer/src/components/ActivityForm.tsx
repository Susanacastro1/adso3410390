import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Flag,
  Loader2,
  Save,
  Timer
} from 'lucide-react'
import {
  addMinutesToTime,
  calculateDuration,
  formatDuration,
  isValidDateString,
  isValidTimeString,
  minutesToTime,
  timeToMinutes,
  todayISO
} from '@shared/domain/time'
import type {
  Activity,
  ActivityInput,
  ActivityStatus,
  Category,
  Priority,
  Settings
} from '@shared/types'
import { ApiError, errorMessage, getApi, unwrap } from '../services/api'
import { useToast } from './Toast'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import { ConflictDialog } from './ConflictDialog'
import { CategoryPill } from './ActivityBadges'

interface ActivityFormProps {
  open: boolean
  initial?: Activity | null
  prefill?: Partial<ActivityInput>
  categories: Category[]
  settings: Settings
  onClose: () => void
  onSaved: (activity: Activity) => void
}

interface FormValues {
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  categoryId: number
  priority: Priority
  status: ActivityStatus
}

type FieldErrors = Record<string, string>

function safeDefaultTimes(settings: Settings): { startTime: string; endTime: string } {
  let start = settings.workStart
  if (!isValidTimeString(start)) start = '08:00'
  if (timeToMinutes(start) > 23 * 60 + 25) start = '23:00'
  const duration = Math.max(5, settings.defaultDuration)
  let end = addMinutesToTime(start, duration)
  if (end <= start) end = '23:59'
  return { startTime: start, endTime: end }
}

function buildValues(
  initial: Activity | null | undefined,
  prefill: Partial<ActivityInput> | undefined,
  categories: Category[],
  settings: Settings
): FormValues {
  const fallbackTimes = safeDefaultTimes(settings)
  const startTime = initial?.startTime ?? prefill?.startTime ?? fallbackTimes.startTime
  const endTime =
    initial?.endTime ??
    prefill?.endTime ??
    (startTime === fallbackTimes.startTime ? fallbackTimes.endTime : addMinutesToTime(startTime, 60))

  return {
    title: initial?.title ?? prefill?.title ?? '',
    description: initial?.description ?? prefill?.description ?? '',
    date: initial?.date ?? prefill?.date ?? todayISO(),
    startTime,
    endTime: endTime > startTime ? endTime : '23:59',
    categoryId: initial?.categoryId ?? prefill?.categoryId ?? categories[0]?.id ?? 0,
    priority: initial?.priority ?? prefill?.priority ?? 'media',
    status: initial?.status ?? prefill?.status ?? 'pendiente'
  }
}

function validate(values: FormValues, categories: Category[]): FieldErrors {
  const errors: FieldErrors = {}
  const title = values.title.trim()

  if (!title) errors.title = 'El nombre de la actividad es obligatorio.'
  else if (title.length > 120) errors.title = 'El nombre no puede superar 120 caracteres.'
  if (values.description.length > 1000) errors.description = 'La descripción no puede superar 1000 caracteres.'
  if (!values.date || !isValidDateString(values.date)) errors.date = 'Selecciona una fecha válida.'
  if (!isValidTimeString(values.startTime)) errors.startTime = 'Selecciona una hora de inicio válida.'
  if (!isValidTimeString(values.endTime)) errors.endTime = 'Selecciona una hora de fin válida.'
  if (
    isValidTimeString(values.startTime) &&
    isValidTimeString(values.endTime) &&
    values.endTime <= values.startTime
  ) {
    errors.endTime = 'La hora de fin debe ser posterior a la hora de inicio.'
  }
  if (!values.categoryId || !categories.some((category) => category.id === values.categoryId)) {
    errors.categoryId = 'Selecciona una categoría.'
  }
  return errors
}

export function ActivityForm({
  open,
  initial,
  prefill,
  categories,
  settings,
  onClose,
  onSaved
}: ActivityFormProps): ReactElement {
  const formId = useId()
  const toast = useToast()
  const [values, setValues] = useState<FormValues>(() =>
    buildValues(initial, prefill, categories, settings)
  )
  const baseline = useRef<string>(JSON.stringify(values))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [conflicts, setConflicts] = useState<Activity[]>([])
  const [pendingInput, setPendingInput] = useState<ActivityInput | null>(null)
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)

  const editing = Boolean(initial)
  const duration = useMemo(() => {
    if (!isValidTimeString(values.startTime) || !isValidTimeString(values.endTime)) return 0
    return Math.max(0, calculateDuration(values.startTime, values.endTime))
  }, [values.startTime, values.endTime])

  const isDirty = JSON.stringify(values) !== baseline.current
  const category = categories.find((item) => item.id === values.categoryId)

  useEffect(() => {
    if (!open) return undefined
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void handleSubmit()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, values, saving, checking])

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]): void {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function handleBlur(field: keyof FormValues): void {
    setTouched((current) => ({ ...current, [field]: true }))
    const nextErrors = validate({ ...values }, categories)
    setErrors((current) => {
      const updated = { ...current }
      if (nextErrors[field]) updated[field] = nextErrors[field]
      else delete updated[field]
      return updated
    })
  }

  function toInput(): ActivityInput {
    return {
      title: values.title.trim(),
      description: values.description.trim(),
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      categoryId: values.categoryId,
      priority: values.priority,
      status: values.status
    }
  }

  async function persist(input: ActivityInput, force: boolean): Promise<void> {
    setSaving(true)
    try {
      const api = getApi()
      const saved = initial
        ? await unwrap(api.activities.update(initial.id, input, force))
        : await unwrap(api.activities.create(input, force))
      toast.success(editing ? 'Actividad actualizada correctamente.' : 'Actividad creada correctamente.')
      setShowConflictDialog(false)
      setConflicts([])
      setPendingInput(null)
      onSaved(saved)
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'CONFLICT' &&
        error.details &&
        typeof error.details === 'object' &&
        'conflicts' in error.details
      ) {
        const detail = error.details as { conflicts?: Activity[] }
        setConflicts(detail.conflicts ?? [])
        setPendingInput(input)
        setShowConflictDialog(true)
      } else {
        toast.error(errorMessage(error))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(): Promise<void> {
    if (saving || checking) return
    const nextErrors = validate(values, categories)
    setErrors(nextErrors)
    setTouched(
      Object.fromEntries(
        ['title', 'description', 'date', 'startTime', 'endTime', 'categoryId'].map((field) => [
          field,
          true
        ])
      )
    )
    if (Object.keys(nextErrors).length > 0) return

    const input = toInput()
    setChecking(true)
    try {
      const api = getApi()
      const result = await unwrap(api.activities.checkConflicts(input, initial?.id))
      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts)
        setPendingInput(input)
        setShowConflictDialog(true)
        return
      }
      await persist(input, false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setChecking(false)
    }
  }

  async function handleForceSave(): Promise<void> {
    if (!pendingInput) return
    await persist(pendingInput, true)
  }

  function requestClose(): void {
    if (saving) return
    if (showConflictDialog) {
      setShowConflictDialog(false)
      return
    }
    if (showDiscard) {
      setShowDiscard(false)
      return
    }
    if (isDirty) {
      setShowDiscard(true)
      return
    }
    onClose()
  }

  const fieldError = (field: string): string | undefined =>
    touched[field] ? errors[field] : errors[field]

  return (
    <>
      <Modal
        open={open}
        title={editing ? 'Editar actividad' : 'Nueva actividad'}
        subtitle={
          editing
            ? 'Actualiza los datos y guarda los cambios.'
            : 'Completa la información para programar tu actividad.'
        }
        size="lg"
        onClose={requestClose}
        footer={
          <>
            <button type="button" className="button ghost" onClick={requestClose} disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
              form={formId}
              className="button primary"
              disabled={saving || checking || categories.length === 0}
            >
              {saving || checking ? <Loader2 size={17} className="spin" /> : <Save size={17} />}
              {saving ? 'Guardando…' : checking ? 'Verificando…' : editing ? 'Guardar cambios' : 'Crear actividad'}
            </button>
          </>
        }
      >
        <form
          id={formId}
          className="activity-form"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
          noValidate
        >
          {Object.keys(errors).length > 0 && (
            <div className="form-error-banner" role="alert">
              <AlertCircle size={17} />
              Revisa los campos marcados antes de continuar.
            </div>
          )}

          <div className="form-field full">
            <label htmlFor="activity-title">Nombre de la actividad *</label>
            <input
              id="activity-title"
              className={`input ${fieldError('title') ? 'has-error' : ''}`}
              value={values.title}
              maxLength={120}
              autoFocus
              placeholder="Ej. Reunión de equipo, estudiar cálculo, ir al gimnasio…"
              onChange={(event) => update('title', event.target.value)}
              onBlur={() => handleBlur('title')}
            />
            <div className="field-meta">
              {fieldError('title') ? (
                <span className="field-error">{fieldError('title')}</span>
              ) : (
                <span className="field-hint">Obligatorio. Máximo 120 caracteres.</span>
              )}
              <span className="field-counter">{values.title.length}/120</span>
            </div>
          </div>

          <div className="form-field full">
            <label htmlFor="activity-description">Descripción</label>
            <textarea
              id="activity-description"
              className={`input textarea ${fieldError('description') ? 'has-error' : ''}`}
              value={values.description}
              maxLength={1000}
              rows={3}
              placeholder="Notas, objetivos o detalles de la actividad (opcional)."
              onChange={(event) => update('description', event.target.value)}
              onBlur={() => handleBlur('description')}
            />
            <div className="field-meta">
              {fieldError('description') ? (
                <span className="field-error">{fieldError('description')}</span>
              ) : (
                <span className="field-hint">Opcional. Máximo 1000 caracteres.</span>
              )}
              <span className="field-counter">{values.description.length}/1000</span>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="activity-date">
                <CalendarDays size={15} /> Fecha *
              </label>
              <input
                id="activity-date"
                type="date"
                className={`input ${fieldError('date') ? 'has-error' : ''}`}
                value={values.date}
                onChange={(event) => update('date', event.target.value)}
                onBlur={() => handleBlur('date')}
              />
              {fieldError('date') && <span className="field-error">{fieldError('date')}</span>}
            </div>

            <div className="form-field">
              <label htmlFor="activity-category">Categoría *</label>
              <select
                id="activity-category"
                className={`input ${fieldError('categoryId') ? 'has-error' : ''}`}
                value={values.categoryId || ''}
                onChange={(event) => update('categoryId', Number(event.target.value))}
                onBlur={() => handleBlur('categoryId')}
              >
                <option value="" disabled>
                  Selecciona una categoría
                </option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {fieldError('categoryId') && (
                <span className="field-error">{fieldError('categoryId')}</span>
              )}
              {category && (
                <span className="select-preview">
                  <CategoryPill category={category} subtle />
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="activity-start">
                <Clock3 size={15} /> Hora de inicio *
              </label>
              <input
                id="activity-start"
                type="time"
                step={300}
                className={`input ${fieldError('startTime') ? 'has-error' : ''}`}
                value={values.startTime}
                onChange={(event) => update('startTime', event.target.value)}
                onBlur={() => handleBlur('startTime')}
              />
              {fieldError('startTime') && (
                <span className="field-error">{fieldError('startTime')}</span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="activity-end">
                <Clock3 size={15} /> Hora de fin *
              </label>
              <input
                id="activity-end"
                type="time"
                step={300}
                className={`input ${fieldError('endTime') ? 'has-error' : ''}`}
                value={values.endTime}
                onChange={(event) => update('endTime', event.target.value)}
                onBlur={() => handleBlur('endTime')}
              />
              {fieldError('endTime') && <span className="field-error">{fieldError('endTime')}</span>}
            </div>
          </div>

          <div className="duration-preview">
            <span className="duration-icon">
              <Timer size={18} />
            </span>
            <div>
              <span>Duración calculada</span>
              <strong>{duration > 0 ? formatDuration(duration) : '—'}</strong>
            </div>
            <small>Se calcula automáticamente según las horas.</small>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>
                <Flag size={15} /> Prioridad
              </label>
              <div className="segmented" role="group" aria-label="Prioridad">
                {(['alta', 'media', 'baja'] as Priority[]).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    className={`segment ${values.priority === priority ? 'active' : ''} segment-${priority}`}
                    onClick={() => update('priority', priority)}
                    aria-pressed={values.priority === priority}
                  >
                    {priority === 'alta' ? 'Alta' : priority === 'media' ? 'Media' : 'Baja'}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label>Estado</label>
              <div className="segmented" role="group" aria-label="Estado">
                <button
                  type="button"
                  className={`segment ${values.status === 'pendiente' ? 'active' : ''}`}
                  onClick={() => update('status', 'pendiente')}
                  aria-pressed={values.status === 'pendiente'}
                >
                  <Circle size={14} /> Pendiente
                </button>
                <button
                  type="button"
                  className={`segment ${values.status === 'completada' ? 'active' : ''}`}
                  onClick={() => update('status', 'completada')}
                  aria-pressed={values.status === 'completada'}
                >
                  <CheckCircle2 size={14} /> Completada
                </button>
              </div>
            </div>
          </div>

          <p className="form-shortcut-hint">
            Atajo: <kbd>Ctrl</kbd> + <kbd>Enter</kbd> para guardar · <kbd>Esc</kbd> para cerrar
          </p>
        </form>
      </Modal>

      <ConflictDialog
        open={showConflictDialog}
        conflicts={conflicts}
        busy={saving}
        onCancel={() => setShowConflictDialog(false)}
        onConfirm={() => void handleForceSave()}
      />

      <ConfirmDialog
        open={showDiscard}
        title="Descartar cambios"
        message="Hay cambios sin guardar en esta actividad. ¿Quieres descartarlos?"
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
