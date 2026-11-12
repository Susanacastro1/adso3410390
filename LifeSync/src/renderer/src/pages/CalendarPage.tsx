import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  isSameMonth,
  isToday
} from 'date-fns'
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Sparkles
} from 'lucide-react'
import {
  addMinutesToTime,
  dateToISO,
  formatDuration,
  minutesToTime,
  todayISO
} from '@shared/domain/time'
import type { Activity, Settings } from '@shared/types'
import { useActivities } from '../hooks/useActivities'
import { useCategories } from '../hooks/useCategories'
import { useSettings } from '../hooks/useSettings'
import { useActivityDialog } from '../context/ActivityDialogContext'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import {
  CategoryPill,
  ConflictBadge,
  PriorityBadge
} from '../components/ActivityBadges'
import {
  formatDateFromDate,
  formatLongDate,
  formatMonthShort,
  formatMonthTitle,
  formatWeekRange,
  getMonthGrid,
  getWeekDays,
  getWeekdayLabels,
  parseLocalDate,
  weekStartsOnNumber
} from '../utils/date'
import { hexToRgba } from '../utils/colors'
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  HOUR_HEIGHT,
  SLOT_HEIGHT,
  TIME_SLOTS,
  eventPosition,
  layoutDayActivities,
  minutesToOffset
} from '../utils/calendar'
import { timeToMinutes } from '@shared/domain/time'

type CalendarView = 'day' | 'week' | 'month'

interface CalendarEventProps {
  activity: Activity
  top: number
  height: number
  left: number | string
  width: number | string
  onOpen: (activity: Activity) => void
}

function CalendarEvent({
  activity,
  top,
  height,
  left,
  width,
  onOpen
}: CalendarEventProps): ReactElement {
  const hasConflict = activity.conflictIds.length > 0
  return (
    <button
      type="button"
      className={`calendar-event ${activity.status === 'completada' ? 'completed' : ''} ${hasConflict ? 'has-conflict' : ''}`}
      style={{
        top,
        height,
        left,
        width,
        backgroundColor: hexToRgba(activity.category.color, 0.16),
        borderLeftColor: activity.category.color
      }}
      onClick={(event) => {
        event.stopPropagation()
        onOpen(activity)
      }}
      title={`${activity.title} · ${activity.startTime} – ${activity.endTime}`}
    >
      <span className="calendar-event-time" style={{ color: activity.category.color }}>
        {activity.startTime} – {activity.endTime}
        {hasConflict && <AlertTriangle size={11} />}
      </span>
      <span className="calendar-event-title">{activity.title}</span>
      {height > 42 && (
        <span className="calendar-event-category">{activity.category.name}</span>
      )}
      {height > 68 && (
        <span className="calendar-event-footer">
          <PriorityBadge priority={activity.priority} />
          <span>{formatDuration(activity.duration)}</span>
        </span>
      )}
    </button>
  )
}

interface DayColumnProps {
  date: string
  activities: Activity[]
  settings: Settings
  onCreateAt: (date: string, startTime: string) => void
  onOpen: (activity: Activity) => void
  compact?: boolean
}

function useScrollToWorkStart(workStart: string, dependency: string): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const target = Math.max(0, minutesToOffset(timeToMinutes(workStart)) - 24)
    ref.current.scrollTop = target
  }, [workStart, dependency])
  return ref
}

function TimeAxis(): ReactElement {
  return (
    <div className="time-axis" style={{ height: (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT }}>
      {Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, index) => (
        <span
          key={index}
          className="time-axis-label"
          style={{ top: index * HOUR_HEIGHT }}
        >
          {String(CALENDAR_START_HOUR + index).padStart(2, '0')}:00
        </span>
      ))}
    </div>
  )
}

function Slots({
  date,
  onCreateAt,
  compact = false
}: {
  date: string
  onCreateAt: (date: string, startTime: string) => void
  compact?: boolean
}): ReactElement {
  return (
    <div className={`slot-stack ${compact ? 'compact' : ''}`}>
      {TIME_SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          className="time-slot"
          style={{ height: SLOT_HEIGHT }}
          onClick={() => onCreateAt(date, minutesToTime(slot))}
          aria-label={`Crear actividad el ${date} a las ${minutesToTime(slot)}`}
        />
      ))}
    </div>
  )
}

function DayView({
  date,
  activities,
  settings,
  onCreateAt,
  onOpen
}: {
  date: string
  activities: Activity[]
  settings: Settings
  onCreateAt: (date: string, startTime: string) => void
  onOpen: (activity: Activity) => void
}): ReactElement {
  const scrollRef = useScrollToWorkStart(settings.workStart, date)
  const positioned = layoutDayActivities(activities)
  const now = new Date()
  const today = date === todayISO()
  const nowTop = minutesToOffset(now.getHours() * 60 + now.getMinutes())

  return (
    <div className="calendar-scroll" ref={scrollRef}>
      <div className="day-view">
        <TimeAxis />
        <div
          className="day-column"
          style={{ height: (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT }}
        >
          <Slots date={date} onCreateAt={onCreateAt} />
          {positioned.map(({ activity, column, columns }) => {
            const { top, height } = eventPosition(activity.startTime, activity.endTime)
            return (
              <CalendarEvent
                key={activity.id}
                activity={activity}
                top={top}
                height={height}
                left={`calc(${(column / columns) * 100}% + 2px)`}
                width={`calc(${100 / columns}% - 4px)`}
                onOpen={onOpen}
              />
            )
          })}
          {today && (
            <div className="now-line" style={{ top: nowTop }}>
              <span>Ahora</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WeekView({
  anchor,
  weekStart,
  activitiesByDate,
  settings,
  onCreateAt,
  onOpen,
  onSelectDay
}: {
  anchor: Date
  weekStart: Settings['weekStartsOn']
  activitiesByDate: Map<string, Activity[]>
  settings: Settings
  onCreateAt: (date: string, startTime: string) => void
  onOpen: (activity: Activity) => void
  onSelectDay: (date: Date) => void
}): ReactElement {
  const days = getWeekDays(anchor, weekStart)
  const scrollRef = useScrollToWorkStart(settings.workStart, formatWeekRange(anchor, weekStart))
  const now = new Date()
  const nowTop = minutesToOffset(now.getHours() * 60 + now.getMinutes())

  return (
    <div className="week-scroll" ref={scrollRef}>
      <div className="week-inner">
        <div className="week-header-row">
          <span className="week-corner" />
          {days.map((day) => {
            const iso = dateToISO(day)
            return (
              <button
                key={iso}
                type="button"
                className={`week-day-heading ${isToday(day) ? 'today' : ''}`}
                onClick={() => onSelectDay(day)}
              >
                <span>{formatDateFromDate(day).split(',')[0]}</span>
                <strong>{day.getDate()}</strong>
                <small>{formatMonthShort(day)}</small>
              </button>
            )
          })}
        </div>

        <div className="week-body">
          <TimeAxis />
          {days.map((day) => {
            const iso = dateToISO(day)
            const positioned = layoutDayActivities(activitiesByDate.get(iso) ?? [])
            return (
              <div
                key={iso}
                className={`week-column ${isToday(day) ? 'today' : ''}`}
                style={{ height: (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT }}
              >
                <Slots date={iso} onCreateAt={onCreateAt} compact />
                {positioned.map(({ activity, column, columns }) => {
                  const { top, height } = eventPosition(activity.startTime, activity.endTime)
                  return (
                    <CalendarEvent
                      key={activity.id}
                      activity={activity}
                      top={top}
                      height={height}
                      left={`calc(${(column / columns) * 100}% + 1px)`}
                      width={`calc(${100 / columns}% - 2px)`}
                      onOpen={onOpen}
                    />
                  )
                })}
                {isToday(day) && <div className="now-line" style={{ top: nowTop }} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MonthView({
  anchor,
  weekStart,
  activitiesByDate,
  onOpen,
  onSelectDay
}: {
  anchor: Date
  weekStart: Settings['weekStartsOn']
  activitiesByDate: Map<string, Activity[]>
  onOpen: (activity: Activity) => void
  onSelectDay: (date: Date) => void
}): ReactElement {
  const days = getMonthGrid(anchor, weekStart)
  const labels = getWeekdayLabels(weekStart)

  return (
    <div className="month-view">
      <div className="month-weekdays">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="month-grid">
        {days.map((day) => {
          const iso = dateToISO(day)
          const items = activitiesByDate.get(iso) ?? []
          const outside = !isSameMonth(day, anchor)
          return (
            <div
              key={iso}
              className={`month-cell ${outside ? 'outside' : ''} ${isToday(day) ? 'today' : ''} ${items.length > 0 ? 'has-items' : ''}`}
              onClick={() => onSelectDay(day)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectDay(day)
                }
              }}
              aria-label={`Ver día ${formatLongDate(iso)}`}
            >
              <div className="month-day-head">
                <span>{day.getDate()}</span>
                {items.length > 0 && <small>{items.length}</small>}
              </div>
              <div className="month-chips">
                {items.slice(0, 3).map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    className={`month-chip ${activity.status === 'completada' ? 'completed' : ''} ${activity.conflictIds.length > 0 ? 'has-conflict' : ''}`}
                    style={{
                      backgroundColor: hexToRgba(activity.category.color, 0.13),
                      borderLeftColor: activity.category.color
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpen(activity)
                    }}
                    title={`${activity.title} · ${activity.startTime} – ${activity.endTime}`}
                  >
                    <span className="month-chip-time">{activity.startTime}</span>
                    <span className="month-chip-title">{activity.title}</span>
                    {activity.conflictIds.length > 0 && <AlertTriangle size={11} />}
                  </button>
                ))}
                {items.length > 3 && (
                  <button
                    type="button"
                    className="month-more"
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelectDay(day)
                    }}
                  >
                    +{items.length - 3} más
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CalendarPage(): ReactElement {
  const { openCreate, openDetail } = useActivityDialog()
  const settings = useSettings()
  const categories = useCategories()
  const [view, setView] = useState<CalendarView>('month')
  const [anchor, setAnchor] = useState<Date>(() => parseLocalDate(todayISO()))

  const weekStart = settings.data?.weekStartsOn ?? 'monday'

  const range = useMemo(() => {
    if (view === 'day') {
      const iso = dateToISO(anchor)
      return { from: iso, to: iso }
    }
    if (view === 'week') {
      const days = getWeekDays(anchor, weekStart)
      return { from: dateToISO(days[0]), to: dateToISO(days[6]) }
    }
    const days = getMonthGrid(anchor, weekStart)
    return { from: dateToISO(days[0]), to: dateToISO(days[days.length - 1]) }
  }, [view, anchor, weekStart])

  const activities = useActivities({ from: range.from, to: range.to, sort: 'asc' })

  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const activity of activities.data ?? []) {
      const list = map.get(activity.date) ?? []
      list.push(activity)
      map.set(activity.date, list)
    }
    return map
  }, [activities.data])

  const selectDay = (date: Date): void => {
    setAnchor(date)
    setView('day')
  }

  const createAt = (date: string, startTime: string): void => {
    const duration = settings.data?.defaultDuration ?? 60
    let endTime = addMinutesToTime(startTime, duration)
    if (endTime <= startTime) endTime = '23:59'
    openCreate({
      date,
      startTime,
      endTime,
      priority: 'media',
      status: 'pendiente'
    })
  }

  const goToday = (): void => setAnchor(new Date())
  const goPrevious = (): void => {
    if (view === 'day') setAnchor((current) => addDays(current, -1))
    else if (view === 'week') setAnchor((current) => addWeeks(current, -1))
    else setAnchor((current) => addMonths(current, -1))
  }
  const goNext = (): void => {
    if (view === 'day') setAnchor((current) => addDays(current, 1))
    else if (view === 'week') setAnchor((current) => addWeeks(current, 1))
    else setAnchor((current) => addMonths(current, 1))
  }

  const periodTitle =
    view === 'day'
      ? formatLongDate(dateToISO(anchor))
      : view === 'week'
        ? formatWeekRange(anchor, weekStart)
        : formatMonthTitle(dateToISO(anchor))

  const dayActivities = activitiesByDate.get(dateToISO(anchor)) ?? []
  const totalInRange = activities.data?.length ?? 0
  const conflictsInRange = (activities.data ?? []).filter(
    (activity) => activity.conflictIds.length > 0
  ).length

  if (settings.loading && !settings.data) {
    return (
      <>
        <PageHeader eyebrow="Planificación" title="Calendario" subtitle="Cargando tu calendario…" />
        <PageSkeleton rows={4} />
      </>
    )
  }

  if (!settings.data) {
    return (
      <>
        <PageHeader eyebrow="Planificación" title="Calendario" />
        <div className="card error-panel">
          <AlertTriangle size={22} />
          <div>
            <strong>No se pudo cargar el calendario</strong>
            <p>{settings.error ?? 'Ocurrió un error inesperado.'}</p>
          </div>
          <button type="button" className="button secondary" onClick={settings.reload}>
            Reintentar
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Planificación"
        title="Calendario"
        subtitle="Visualiza tus actividades por día, semana o mes."
        actions={
          <button
            type="button"
            className="button primary"
            onClick={() => openCreate({ date: dateToISO(anchor) })}
          >
            <Plus size={18} /> Nueva actividad
          </button>
        }
      />

      <section className="calendar-shell card">
        <div className="calendar-toolbar">
          <div className="calendar-nav">
            <button type="button" className="icon-button" onClick={goPrevious} aria-label="Anterior">
              <ChevronLeft size={19} />
            </button>
            <button type="button" className="button secondary small" onClick={goToday}>
              Hoy
            </button>
            <button type="button" className="icon-button" onClick={goNext} aria-label="Siguiente">
              <ChevronRight size={19} />
            </button>
            <div className="calendar-period">
              <CalendarDays size={17} />
              <strong>{periodTitle}</strong>
              <span>
                {totalInRange} {totalInRange === 1 ? 'actividad' : 'actividades'}
                {conflictsInRange > 0 && (
                  <> · <AlertTriangle size={12} /> {conflictsInRange} con conflicto</>
                )}
              </span>
            </div>
          </div>

          <div className="segmented view-switch" role="group" aria-label="Vista del calendario">
            <button
              type="button"
              className={view === 'day' ? 'active' : ''}
              onClick={() => setView('day')}
              aria-pressed={view === 'day'}
            >
              Día
            </button>
            <button
              type="button"
              className={view === 'week' ? 'active' : ''}
              onClick={() => setView('week')}
              aria-pressed={view === 'week'}
            >
              Semana
            </button>
            <button
              type="button"
              className={view === 'month' ? 'active' : ''}
              onClick={() => setView('month')}
              aria-pressed={view === 'month'}
            >
              Mes
            </button>
          </div>
        </div>

        {activities.loading && !activities.data ? (
          <div className="calendar-loading">
            <PageSkeleton rows={3} />
          </div>
        ) : activities.error ? (
          <div className="error-panel borderless">
            <AlertTriangle size={22} />
            <div>
              <strong>No se pudieron cargar las actividades</strong>
              <p>{activities.error}</p>
            </div>
            <button type="button" className="button secondary" onClick={activities.reload}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {view === 'day' && (
              <>
                {dayActivities.length === 0 && (
                  <div className="calendar-day-note">
                    <Sparkles size={16} />
                    Día libre. Haz clic en un franja horaria para crear una actividad.
                  </div>
                )}
                <DayView
                  date={dateToISO(anchor)}
                  activities={dayActivities}
                  settings={settings.data}
                  onCreateAt={createAt}
                  onOpen={openDetail}
                />
              </>
            )}
            {view === 'week' && (
              <WeekView
                anchor={anchor}
                weekStart={weekStart}
                activitiesByDate={activitiesByDate}
                settings={settings.data}
                onCreateAt={createAt}
                onOpen={openDetail}
                onSelectDay={selectDay}
              />
            )}
            {view === 'month' && (
              <MonthView
                anchor={anchor}
                weekStart={weekStart}
                activitiesByDate={activitiesByDate}
                onOpen={openDetail}
                onSelectDay={selectDay}
              />
            )}
          </>
        )}

        <div className="calendar-footer">
          <div className="calendar-legend">
            {categories.data?.map((category) => (
              <span key={category.id}>
                <span className="legend-dot" style={{ backgroundColor: category.color }} />
                {category.name}
              </span>
            ))}
          </div>
          <span className="calendar-hint">
            <Clock3 size={14} />
            {view === 'month'
              ? 'Haz clic en un día para ver su agenda.'
              : 'Haz clic en un espacio libre para agendar.'}
          </span>
        </div>
      </section>

      {view === 'day' && dayActivities.length > 0 && (
        <section className="card day-summary-card">
          <div className="card-header">
            <div>
              <h2>Agenda del día</h2>
              <p>{dayActivities.length} actividades programadas · {formatDateFromDate(anchor)}</p>
            </div>
          </div>
          <ul className="day-agenda-list">
            {dayActivities.map((activity) => (
              <li key={activity.id}>
                <button type="button" onClick={() => openDetail(activity)}>
                  <span className="agenda-time">{activity.startTime} – {activity.endTime}</span>
                  <span className="agenda-title">{activity.title}</span>
                  <CategoryPill category={activity.category} subtle />
                  <PriorityBadge priority={activity.priority} />
                  <ConflictBadge count={activity.conflictIds.length} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
