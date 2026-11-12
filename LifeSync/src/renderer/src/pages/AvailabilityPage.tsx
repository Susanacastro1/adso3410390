import { useState, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Settings as SettingsIcon,
  Sun,
  Timer
} from 'lucide-react'
import {
  addMinutesToTime,
  formatDuration,
  timeToMinutes,
  todayISO
} from '@shared/domain/time'
import { useAvailability, useAvailabilityRange } from '../hooks/useAvailability'
import { useSettings } from '../hooks/useSettings'
import { useActivityDialog } from '../context/ActivityDialogContext'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import {
  formatLongDate,
  formatShortDate,
  formatWeekday,
  addDaysISO,
  parseLocalDate,
  relativeDateLabel
} from '../utils/date'
import { hexToRgba } from '../utils/colors'
import type { DayAvailability } from '@shared/types'

function AvailabilityTimeline({ day }: { day: DayAvailability }): ReactElement {
  const start = timeToMinutes(day.workStart)
  const end = timeToMinutes(day.workEnd)
  const total = Math.max(1, end - start)

  return (
    <div className="availability-visual">
      <div className="availability-track" aria-label="Línea de tiempo de ocupación">
        {day.free.map((slot) => {
          const slotStart = timeToMinutes(slot.start)
          const slotEnd = timeToMinutes(slot.end)
          return (
            <span
              key={`free-${slot.start}`}
              className="timeline-free"
              style={{
                left: `${((slotStart - start) / total) * 100}%`,
                width: `${((slotEnd - slotStart) / total) * 100}%`
              }}
              title={`Libre ${slot.start} – ${slot.end}`}
            />
          )
        })}
        {day.busy.map((activity) => {
          const busyStart = Math.max(start, timeToMinutes(activity.startTime))
          const busyEnd = Math.min(end, timeToMinutes(activity.endTime))
          if (busyEnd <= busyStart) return null
          return (
            <span
              key={`busy-${activity.activityId}`}
              className="timeline-busy"
              style={{
                left: `${((busyStart - start) / total) * 100}%`,
                width: `${((busyEnd - busyStart) / total) * 100}%`,
                backgroundColor: activity.categoryColor
              }}
              title={`${activity.title} · ${activity.startTime} – ${activity.endTime}`}
            />
          )
        })}
      </div>
      <div className="availability-ticks">
        <span>{day.workStart}</span>
        <span>{formatDuration(Math.round(total / 2))} de jornada</span>
        <span>{day.workEnd}</span>
      </div>
      <div className="timeline-legend">
        <span><span className="legend-dot free" /> Disponible</span>
        <span><span className="legend-dot busy" /> Ocupado</span>
      </div>
    </div>
  )
}

export function AvailabilityPage(): ReactElement {
  const [selected, setSelected] = useState(todayISO())
  const day = useAvailability(selected)
  const range = useAvailabilityRange(todayISO(), 7)
  const settings = useSettings()
  const { openCreate } = useActivityDialog()

  const move = (days: number): void => setSelected((current) => addDaysISO(current, days))

  const scheduleIn = (start: string, end: string): void => {
    const duration = settings.data?.defaultDuration ?? 60
    let suggestedEnd = addMinutesToTime(start, duration)
    if (suggestedEnd > end || suggestedEnd <= start) suggestedEnd = end
    openCreate({
      date: selected,
      startTime: start,
      endTime: suggestedEnd,
      priority: 'media',
      status: 'pendiente'
    })
  }

  return (
    <>
      <PageHeader
        eyebrow="Planificación"
        title="Horarios disponibles"
        subtitle="Descubre los espacios libres reales de tu jornada y agenda en ellos."
        actions={
          <Link to="/configuracion" className="button secondary">
            <SettingsIcon size={18} /> Configurar jornada
          </Link>
        }
      />

      <section className="card date-navigator">
        <button type="button" className="icon-button" onClick={() => move(-1)} aria-label="Día anterior">
          <ChevronLeft size={19} />
        </button>
        <div className="date-navigator-main">
          <span className="eyebrow">Consultando disponibilidad</span>
          <strong>{formatLongDate(selected)}</strong>
          <span>{relativeDateLabel(selected)}</span>
        </div>
        <input
          type="date"
          className="input date-input"
          value={selected}
          onChange={(event) => setSelected(event.target.value || todayISO())}
          aria-label="Seleccionar fecha"
        />
        <button type="button" className="button secondary small" onClick={() => setSelected(todayISO())}>
          Hoy
        </button>
        <button type="button" className="icon-button" onClick={() => move(1)} aria-label="Día siguiente">
          <ChevronRight size={19} />
        </button>
      </section>

      {day.loading && !day.data ? (
        <PageSkeleton rows={4} />
      ) : day.error || !day.data ? (
        <div className="card error-panel">
          <AlertTriangle size={22} />
          <div>
            <strong>No se pudo calcular la disponibilidad</strong>
            <p>{day.error ?? 'Ocurrió un error inesperado.'}</p>
          </div>
          <button type="button" className="button secondary" onClick={day.reload}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <section className="availability-summary" aria-label="Resumen de disponibilidad">
            <article className="availability-stat">
              <span className="availability-stat-icon"><Sun size={20} /></span>
              <div>
                <span>Jornada</span>
                <strong>{day.data.workStart} – {day.data.workEnd}</strong>
                <small>
                  {formatDuration(
                    Math.max(0, timeToMinutes(day.data.workEnd) - timeToMinutes(day.data.workStart))
                  )}{' '}
                  totales
                </small>
              </div>
            </article>
            <article className="availability-stat busy">
              <span className="availability-stat-icon"><CalendarDays size={20} /></span>
              <div>
                <span>Tiempo ocupado</span>
                <strong>{formatDuration(day.data.busyMinutes)}</strong>
                <small>{day.data.busy.length} actividades</small>
              </div>
            </article>
            <article className="availability-stat free">
              <span className="availability-stat-icon"><Coffee size={20} /></span>
              <div>
                <span>Tiempo libre</span>
                <strong>{formatDuration(day.data.freeMinutes)}</strong>
                <small>{day.data.free.length} intervalos disponibles</small>
              </div>
            </article>
            <article className="availability-stat occupancy">
              <span className="availability-stat-icon"><Timer size={20} /></span>
              <div>
                <span>Ocupación</span>
                <strong>{day.data.occupancy}%</strong>
                <div className="occupancy-bar">
                  <div style={{ width: `${day.data.occupancy}%` }} />
                </div>
              </div>
            </article>
          </section>

          <section className="card availability-card">
            <div className="card-header">
              <div>
                <h2>Mapa del día</h2>
                <p>Cada color representa el tiempo ocupado de la jornada.</p>
              </div>
              <span className="header-icon"><Clock3 size={19} /></span>
            </div>
            <AvailabilityTimeline day={day.data} />
          </section>

          <div className="availability-columns">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2>Espacios libres</h2>
                  <p>Agenda directamente en cualquier intervalo.</p>
                </div>
                <span className="count-pill">{day.data.free.length}</span>
              </div>
              {day.data.free.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Coffee size={26} />}
                  title="No hay espacios libres"
                  message="Tu jornada está completa. Prueba otro día o ajusta la jornada."
                />
              ) : (
                <ul className="free-slot-list">
                  {day.data.free.map((slot) => (
                    <li key={`${slot.start}-${slot.end}`}>
                      <div className="slot-time">
                        <strong>{slot.start}</strong>
                        <span>{slot.end}</span>
                      </div>
                      <div className="slot-info">
                        <strong>{formatDuration(slot.duration)} disponibles</strong>
                        <span>{slot.start} – {slot.end}</span>
                      </div>
                      <button
                        type="button"
                        className="button primary small"
                        onClick={() => scheduleIn(slot.start, slot.end)}
                      >
                        <CalendarPlus size={16} /> Agendar aquí
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h2>Actividades del día</h2>
                  <p>Estos intervalos se descuentan de tu jornada.</p>
                </div>
                <span className="count-pill">{day.data.busy.length}</span>
              </div>
              {day.data.busy.length === 0 ? (
                <EmptyState
                  compact
                  icon={<CalendarDays size={26} />}
                  title="Día completamente libre"
                  message="No hay actividades registradas para esta fecha."
                />
              ) : (
                <ul className="busy-slot-list">
                  {day.data.busy.map((activity) => (
                    <li key={activity.activityId}>
                      <span
                        className="busy-accent"
                        style={{ backgroundColor: activity.categoryColor }}
                      />
                      <div className="slot-info">
                        <strong>{activity.title}</strong>
                        <span>
                          {activity.startTime} – {activity.endTime} ·{' '}
                          {formatDuration(
                            Math.max(
                              0,
                              timeToMinutes(activity.endTime) - timeToMinutes(activity.startTime)
                            )
                          )}
                        </span>
                      </div>
                      <span className={`status-badge ${activity.status === 'completada' ? 'is-completed' : ''}`}>
                        {activity.status === 'completada' ? 'Completada' : 'Pendiente'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="card week-availability-card">
            <div className="card-header">
              <div>
                <h2>Próximos 7 días</h2>
                <p>Resumen de tiempo libre y ocupación desde hoy.</p>
              </div>
              <span className="header-icon"><CalendarDays size={19} /></span>
            </div>
            {range.loading && !range.data ? (
              <p className="card-empty-text">Calculando disponibilidad…</p>
            ) : range.data ? (
              <div className="week-availability">
                {range.data.map((entry) => (
                  <button
                    key={entry.date}
                    type="button"
                    className={`week-availability-day ${entry.date === selected ? 'selected' : ''} ${entry.date === todayISO() ? 'today' : ''}`}
                    onClick={() => setSelected(entry.date)}
                  >
                    <span className="week-av-label">
                      {entry.date === todayISO() ? 'Hoy' : formatWeekday(entry.date).slice(0, 3)}
                    </span>
                    <strong>{parseLocalDate(entry.date).getDate()}</strong>
                    <span className="week-av-month">{formatShortDate(entry.date)}</span>
                    <div className="week-av-bar">
                      <div
                        style={{
                          width: `${entry.occupancy}%`,
                          backgroundColor:
                            entry.occupancy > 80
                              ? '#B23A48'
                              : entry.occupancy > 50
                                ? '#C9892B'
                                : '#2E9E6B'
                        }}
                      />
                    </div>
                    <small>{formatDuration(entry.freeMinutes)} libres</small>
                    <small className="muted">{entry.occupancy}% ocupado</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="card-empty-text">No se pudo calcular el resumen semanal.</p>
            )}
          </section>
        </>
      )}
    </>
  )
}
