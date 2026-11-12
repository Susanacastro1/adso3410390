import { useEffect, useState, type ReactElement } from 'react'
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FolderOpen,
  HardDrive,
  Info,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
  WifiOff
} from 'lucide-react'
import {
  formatDuration,
  isValidTimeString,
  timeToMinutes
} from '@shared/domain/time'
import type { Settings, WeekStart } from '@shared/types'
import { errorMessage, getApi, unwrap } from '../services/api'
import { useSettings } from '../hooks/useSettings'
import { useAppInfo, useBackupInfo } from '../hooks/useAppInfo'
import { useDataVersion } from '../context/DataVersionContext'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/LoadingState'
import { useToast } from '../components/Toast'
import {
  formatDateFromDate,
  formatTimestamp,
  greetingForHour
} from '../utils/date'

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const
const WEEK_OPTIONS: Array<{ value: WeekStart; label: string }> = [
  { value: 'monday', label: 'Lunes' },
  { value: 'sunday', label: 'Domingo' }
]

type FieldErrors = Record<string, string>

function validate(values: Settings): FieldErrors {
  const errors: FieldErrors = {}

  if (values.userName.trim().length > 60) {
    errors.userName = 'El nombre no puede superar 60 caracteres.'
  }
  if (!isValidTimeString(values.workStart)) {
    errors.workStart = 'Selecciona una hora de inicio válida.'
  }
  if (!isValidTimeString(values.workEnd)) {
    errors.workEnd = 'Selecciona una hora de fin válida.'
  }
  if (
    isValidTimeString(values.workStart) &&
    isValidTimeString(values.workEnd) &&
    values.workEnd <= values.workStart
  ) {
    errors.workEnd = 'La jornada debe terminar después de empezar.'
  }
  if (!Number.isFinite(values.defaultDuration) || values.defaultDuration < 5) {
    errors.defaultDuration = 'Selecciona una duración válida.'
  }
  if (values.weekStartsOn !== 'monday' && values.weekStartsOn !== 'sunday') {
    errors.weekStartsOn = 'Selecciona el primer día de la semana.'
  }

  return errors
}

function durationOptions(current: number): number[] {
  const values = [...DURATION_OPTIONS] as number[]
  if (!values.includes(current) && Number.isFinite(current) && current > 0) {
    values.push(current)
    values.sort((a, b) => a - b)
  }
  return values
}

export function SettingsPage(): ReactElement {
  const settings = useSettings()
  const appInfo = useAppInfo()
  const backupInfo = useBackupInfo()
  const { bump } = useDataVersion()
  const toast = useToast()

  const [form, setForm] = useState<Settings | null>(null)
  const [baseline, setBaseline] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [openingFolder, setOpeningFolder] = useState(false)
  const [lastExport, setLastExport] = useState<string | null>(null)

  useEffect(() => {
    if (settings.data && form === null) {
      setForm(settings.data)
      setBaseline(JSON.stringify(settings.data))
    }
  }, [settings.data, form])

  const dirty = Boolean(form) && JSON.stringify(form) !== baseline
  const today = new Date()

  useEffect(() => {
    if (!dirty) return undefined
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function update<K extends keyof Settings>(field: K, value: Settings[K]): void {
    setForm((current) => (current ? { ...current, [field]: value } : current))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function save(): Promise<void> {
    if (!form || saving) return
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      const updated = await unwrap(
        getApi().settings.update({
          ...form,
          userName: form.userName.trim()
        })
      )
      setForm(updated)
      setBaseline(JSON.stringify(updated))
      toast.success('Configuración guardada correctamente.')
      bump()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  function discard(): void {
    if (!settings.data) return
    setForm(settings.data)
    setBaseline(JSON.stringify(settings.data))
    setErrors({})
    toast.info('Cambios descartados.')
  }

  async function openDataFolder(): Promise<void> {
    if (openingFolder) return
    setOpeningFolder(true)
    try {
      const result = await unwrap(getApi().app.openDataFolder())
      if (result.opened) toast.success('Carpeta de datos abierta.')
      else toast.error('No se pudo abrir la carpeta de datos.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setOpeningFolder(false)
    }
  }

  async function exportData(): Promise<void> {
    if (exporting) return
    setExporting(true)
    try {
      const result = await unwrap(getApi().backup.export())
      if (!result) {
        toast.info('Exportación cancelada.')
        return
      }
      setLastExport(result.path)
      toast.success(`Copia de seguridad exportada en ${result.path}`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  async function importData(): Promise<void> {
    if (importing) return
    setImporting(true)
    try {
      const result = await unwrap(getApi().backup.import())
      if (!result) {
        toast.info('Importación cancelada.')
        return
      }
      const nextSettings = await unwrap(getApi().settings.get())
      setForm(nextSettings)
      setBaseline(JSON.stringify(nextSettings))
      setErrors({})
      setLastExport(null)
      bump()
      backupInfo.reload()
      toast.success(
        `Copia importada: ${result.activities} ${
          result.activities === 1 ? 'actividad' : 'actividades'
        } y ${result.categories} ${result.categories === 1 ? 'categoría' : 'categorías'}.`
      )
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setImporting(false)
    }
  }

  if (settings.loading && !settings.data) {
    return (
      <>
        <PageHeader
          eyebrow="Preferencias"
          title="Configuración"
          subtitle="Cargando tus preferencias…"
        />
        <PageSkeleton rows={5} />
      </>
    )
  }

  if (!settings.data || !form) {
    return (
      <>
        <PageHeader eyebrow="Preferencias" title="Configuración" />
        <div className="card error-panel">
          <AlertTriangle size={22} />
          <div>
            <strong>No se pudo cargar la configuración</strong>
            <p>{settings.error ?? 'Ocurrió un error inesperado.'}</p>
          </div>
          <button type="button" className="button secondary" onClick={settings.reload}>
            Reintentar
          </button>
        </div>
      </>
    )
  }

  const workMinutes =
    isValidTimeString(form.workStart) &&
    isValidTimeString(form.workEnd) &&
    form.workEnd > form.workStart
      ? timeToMinutes(form.workEnd) - timeToMinutes(form.workStart)
      : 0
  const namePreview = form.userName.trim() || 'bienvenido'
  const initial = form.userName.trim() ? form.userName.trim().charAt(0).toUpperCase() : null
  const backups = backupInfo.data
  const info = appInfo.data

  return (
    <>
      <PageHeader
        eyebrow="Preferencias"
        title="Configuración"
        subtitle="Personaliza tu perfil, tu jornada y la forma en que LifeSync guarda tus datos."
        actions={
          <div className="settings-header-actions">
            {dirty && <span className="unsaved-chip">Cambios sin guardar</span>}
            <button
              type="button"
              className="button ghost"
              onClick={discard}
              disabled={!dirty || saving}
            >
              <RotateCcw size={17} /> Descartar
            </button>
            <button
              type="submit"
              form="settings-form"
              className="button primary"
              disabled={!dirty || saving}
            >
              {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />}
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        }
      />

      <form
        id="settings-form"
        className="settings-layout"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
        noValidate
      >
        <div className="settings-main">
          <section className="card settings-card">
            <div className="card-header">
              <div>
                <h2>Perfil</h2>
                <p>Tu nombre se usa en el saludo del Dashboard y en el menú lateral.</p>
              </div>
              <span className="header-icon"><UserRound size={19} /></span>
            </div>

            <div className="profile-editor">
              <div className="profile-avatar" aria-hidden="true">
                {initial ?? <UserRound size={30} />}
              </div>
              <div className="form-field full">
                <label htmlFor="settings-user-name">Nombre del usuario</label>
                <input
                  id="settings-user-name"
                  className={`input ${errors.userName ? 'has-error' : ''}`}
                  value={form.userName}
                  maxLength={60}
                  placeholder="Ej. Ana, Carlos…"
                  onChange={(event) => update('userName', event.target.value)}
                />
                <div className="field-meta">
                  {errors.userName ? (
                    <span className="field-error">{errors.userName}</span>
                  ) : (
                    <span className="field-hint">
                      Déjalo vacío para usar «Bienvenido».
                    </span>
                  )}
                  <span className="field-counter">{form.userName.length}/60</span>
                </div>
              </div>
            </div>

            <div className="greeting-preview">
              <span className="greeting-icon"><Clock3 size={18} /></span>
              <div>
                <span>Vista previa del saludo</span>
                <strong>{greetingForHour()}, {namePreview}</strong>
              </div>
              <small>{formatDateFromDate(today)}</small>
            </div>
          </section>

          <section className="card settings-card">
            <div className="card-header">
              <div>
                <h2>Jornada</h2>
                <p>Define el rango de tu día. Se usa en Horarios disponibles y el calendario.</p>
              </div>
              <span className="header-icon"><Briefcase size={19} /></span>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="settings-work-start">
                  <Clock3 size={15} /> Inicio de jornada
                </label>
                <input
                  id="settings-work-start"
                  type="time"
                  className={`input ${errors.workStart ? 'has-error' : ''}`}
                  value={form.workStart}
                  onChange={(event) => update('workStart', event.target.value)}
                />
                {errors.workStart && <span className="field-error">{errors.workStart}</span>}
              </div>

              <div className="form-field">
                <label htmlFor="settings-work-end">
                  <Clock3 size={15} /> Fin de jornada
                </label>
                <input
                  id="settings-work-end"
                  type="time"
                  className={`input ${errors.workEnd ? 'has-error' : ''}`}
                  value={form.workEnd}
                  onChange={(event) => update('workEnd', event.target.value)}
                />
                {errors.workEnd && <span className="field-error">{errors.workEnd}</span>}
              </div>
            </div>

            <div className={`workday-preview ${errors.workEnd || errors.workStart ? 'is-invalid' : ''}`}>
              <span className="workday-icon"><Clock3 size={18} /></span>
              <div>
                <span>Duración de la jornada</span>
                <strong>
                  {workMinutes > 0 ? formatDuration(workMinutes) : '—'}
                </strong>
              </div>
              <small>
                {workMinutes > 0
                  ? `${form.workStart} – ${form.workEnd}`
                  : 'La hora de fin debe ser posterior al inicio.'}
              </small>
            </div>
          </section>

          <section className="card settings-card">
            <div className="card-header">
              <div>
                <h2>Preferencias de planificación</h2>
                <p>Valores iniciales que LifeSync aplicará al crear nuevas actividades.</p>
              </div>
              <span className="header-icon"><SlidersHorizontal size={19} /></span>
            </div>

            <div className="form-field full">
              <label>Duración predeterminada</label>
              <div className="duration-options" role="group" aria-label="Duración predeterminada">
                {durationOptions(form.defaultDuration).map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={`duration-option ${form.defaultDuration === minutes ? 'active' : ''}`}
                    onClick={() => update('defaultDuration', minutes)}
                    aria-pressed={form.defaultDuration === minutes}
                  >
                    <strong>{minutes}</strong>
                    <span>min</span>
                  </button>
                ))}
              </div>
              {errors.defaultDuration ? (
                <span className="field-error">{errors.defaultDuration}</span>
              ) : (
                <span className="field-hint">
                  Se sugiere al crear actividades desde el calendario o un espacio libre.
                </span>
              )}
            </div>

            <div className="form-field full">
              <label>Primer día de la semana</label>
              <div className="segmented" role="group" aria-label="Primer día de la semana">
                {WEEK_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`segment ${form.weekStartsOn === option.value ? 'active' : ''}`}
                    onClick={() => update('weekStartsOn', option.value)}
                    aria-pressed={form.weekStartsOn === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="field-hint">
                Afecta a las vistas semanal y mensual del calendario.
              </span>
            </div>
          </section>
        </div>

        <div className="settings-side">
          <section className="card settings-card">
            <div className="card-header">
              <div>
                <h2>Datos y copias de seguridad</h2>
                <p>Tu información se guarda localmente en SQLite.</p>
              </div>
              <span className="header-icon"><Database size={19} /></span>
            </div>

            <div className="data-path-block">
              <span className="data-path-label">
                <HardDrive size={15} /> Ruta de la base de datos
              </span>
              <code title={info?.dbPath ?? ''}>{info?.dbPath ?? 'Cargando…'}</code>
              <button
                type="button"
                className="button secondary small"
                onClick={() => void openDataFolder()}
                disabled={openingFolder}
              >
                {openingFolder ? <Loader2 size={16} className="spin" /> : <FolderOpen size={16} />}
                Abrir carpeta de datos
              </button>
            </div>

            <div className="backup-info">
              <span className="backup-info-icon"><ShieldCheck size={18} /></span>
              <div>
                <span>Última copia automática</span>
                <strong>
                  {backups?.lastBackupAt
                    ? formatTimestamp(backups.lastBackupAt)
                    : 'Sin copias automáticas todavía'}
                </strong>
                <small>
                  Se conservan las últimas 10 copias en la carpeta de datos.
                </small>
              </div>
            </div>

            <div className="settings-actions-stack">
              <button
                type="button"
                className="button secondary"
                onClick={() => void exportData()}
                disabled={exporting || importing}
              >
                {exporting ? <Loader2 size={17} className="spin" /> : <Download size={17} />}
                {exporting ? 'Exportando…' : 'Exportar copia de seguridad (JSON)'}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => void importData()}
                disabled={exporting || importing}
              >
                {importing ? <Loader2 size={17} className="spin" /> : <Upload size={17} />}
                {importing ? 'Importando…' : 'Importar copia de seguridad (JSON)'}
              </button>
            </div>

            {lastExport && (
              <div className="last-export" role="status">
                <CheckCircle2 size={16} />
                <span>
                  Última exportación: <code>{lastExport}</code>
                </span>
              </div>
            )}

            <p className="settings-note">
              Antes de importar se crea una copia automática. La importación reemplaza todas las
              actividades, categorías y preferencias actuales.
            </p>
          </section>

          <section className="card settings-card">
            <div className="card-header">
              <div>
                <h2>Acerca de LifeSync</h2>
                <p>Información técnica de tu instalación.</p>
              </div>
              <span className="header-icon"><Info size={19} /></span>
            </div>

            <dl className="version-list">
              <div>
                <dt>LifeSync</dt>
                <dd>{info?.appVersion ?? '1.0.0'}</dd>
              </div>
              <div>
                <dt>Electron</dt>
                <dd>{info?.electronVersion ?? '—'}</dd>
              </div>
              <div>
                <dt>Node.js</dt>
                <dd>{info?.nodeVersion ?? '—'}</dd>
              </div>
              <div>
                <dt>Chrome</dt>
                <dd>{info?.chromeVersion ?? '—'}</dd>
              </div>
            </dl>

            <div className="offline-banner">
              <WifiOff size={18} />
              <div>
                <strong>Funciona completamente sin conexión</strong>
                <span>LifeSync no envía datos ni realiza peticiones de red.</span>
              </div>
            </div>

            <p className="settings-note">
              Compatible con Windows 10 y Windows 11. Tus datos permanecen únicamente en este
              equipo.
            </p>

            <div className="about-footer">
              <span>LifeSync 1.0.0</span>
              <span>{formatDateFromDate(today)}</span>
            </div>
          </section>
        </div>

        {dirty && (
          <div className="settings-savebar" role="status">
            <span>
              <Info size={16} /> Tienes cambios sin guardar en la configuración.
            </span>
            <div>
              <button
                type="button"
                className="button ghost small"
                onClick={discard}
                disabled={saving}
              >
                Descartar
              </button>
              <button type="submit" className="button primary small" disabled={saving}>
                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </form>

      <p className="settings-footnote">
        Los cambios de jornada y duración se aplican de inmediato en todas las vistas de LifeSync.
      </p>
    </>
  )
}
