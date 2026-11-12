import type { ReactElement, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Flag,
  ListTodo,
  Plus,
  Sparkles,
  TrendingUp
} from 'lucide-react'
import { formatDuration, todayISO } from '@shared/domain/time'
import type { Activity, DashboardStats } from '@shared/types'
import { errorMessage, getApi, unwrap } from '../services/api'
import { useDashboard } from '../hooks/useDashboard'
import { useSettings } from '../hooks/useSettings'
import { useDataVersion } from '../context/DataVersionContext'
import { useActivityDialog } from '../context/ActivityDialogContext'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { ProgressRing } from '../components/ProgressRing'
import { CategoryPill, ConflictBadge, PriorityBadge, StatusBadge } from '../components/ActivityBadges'
import { useToast } from '../components/Toast'
import {
  formatLongDate,
  formatShortDate,
  greetingForHour,
  relativeDateLabel
} from '../utils/date'
import { useState } from 'react'

interface StatCardProps {
  label: string
  value: number | string
  detail: string
  icon: ReactNode
  tone: string
}

function StatCard({ label, value, detail, icon, tone }: StatCardProps): ReactElement {
  return (
    <article className={`stat-card ${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function TodayList({
  activities,
  onOpen
}: {
  activities: Activity[]
  onOpen: (activity: Activity) => void
}): ReactElement {
  if (activities.length === 0) {
    return (
      <EmptyState
        compact
        icon={<CalendarDays size={26} />}
        title="Hoy no tienes actividades"
        message="Tu día está libre. Aprovecha para programar algo importante."
      />
    )
  }

  return (
    <ul className="today-list">
      {activities.map((activity) => (
        <li key={activity.id}>
          <button type="button" className="today-row" onClick={() => onOpen(activity)}>
            <span className="today-time">
              <strong>{activity.startTime}</strong>
              <small>{activity.endTime}</small>
            </span>
            <span
              className="today-accent"
              style={{ backgroundColor: activity.category.color }}
              aria-hidden="true"
            />
            <span className="today-info">
              <span className={`today-title ${activity.status === 'completada' ? 'done' : ''}`}>
                {activity.title}
              </span>
              <span className="today-meta">
                <CategoryPill category={activity.category} subtle />
                <span className="muted-dot">·</span>
                {formatDuration(activity.duration)}
                {activity.conflictIds.length > 0 && (
                  <>
                    <span className="muted-dot">·</span>
                    <ConflictBadge count={activity.conflictIds.length} />
                  </>
                )}
              </span>
            </span>
            <span className="today-status">
              <StatusBadge status={activity.status} />
              <ChevronRight size={17} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function WeeklyChart({ stats }: { stats: DashboardStats }): ReactElement {
  const max = Math.max(1, ...stats.weekBars.map((bar) => bar.count))
  const total = stats.weekBars.reduce((sum, bar) => sum + bar.count, 0)

  return (
    <div className="weekly-chart" role="img" aria-label={`Actividades en los próximos 7 días: ${total}`}>
      {stats.weekBars.map((bar, index) => (
        <div key={bar.date} className={`week-bar ${index === 0 ? 'today' : ''}`}>
          <span className="week-count">{bar.count}</span>
          <div className="week-track">
            <div
              className="week-fill"
              style={{ height: `${Math.max(4, (bar.count / max) * 100)}%` }}
            />
          </div>
          <span className="week-label">{index === 0 ? 'Hoy' : bar.label}</span>
          <span className="week-date">{formatShortDate(bar.date)}</span>
        </div>
      ))}
    </div>
  )
}

export function DashboardPage(): ReactElement {
  const navigate = useNavigate()
  const toast = useToast()
  const { bump } = useDataVersion()
  const { openCreate, openDetail } = useActivityDialog()
  const dashboard = useDashboard()
  const settings = useSettings()
  const [completing, setCompleting] = useState<number | null>(null)

  const today = todayISO()
  const userName = settings.data?.userName?.trim() ?? ''
  const stats = dashboard.data

  async function completeUpcoming(activity: Activity): Promise<void> {
    setCompleting(activity.id)
    try {
      await unwrap(getApi().activities.setStatus(activity.id, 'completada'))
      toast.success('Actividad marcada como completada.')
      bump()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setCompleting(null)
    }
  }

  if (dashboard.loading && !stats) {
    return (
      <>
        <PageHeader
          eyebrow={formatLongDate(today)}
          title={`${greetingForHour()}, ${userName || 'bienvenido'}`}
          subtitle="Este es el resumen de tu organización."
        />
        <PageSkeleton rows={3} />
      </>
    )
  }

  if (!stats) {
    return (
      <>
        <PageHeader
          eyebrow={formatLongDate(today)}
          title={`${greetingForHour()}, ${userName || 'bienvenido'}`}
          subtitle="Este es el resumen de tu organización."
        />
        <div className="card error-panel">
          <AlertTriangle size={22} />
          <div>
            <strong>No se pudo cargar el Dashboard</strong>
            <p>{dashboard.error ?? 'Ocurrió un error inesperado.'}</p>
          </div>
          <button type="button" className="button secondary" onClick={dashboard.reload}>
            Reintentar
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(today)}
        title={`${greetingForHour()}, ${userName || 'bienvenido'}`}
        subtitle="Este es el resumen de tu organización. Todo lo importante, en un solo lugar."
        actions={
          <button type="button" className="button primary" onClick={() => openCreate()}>
            <Plus size={18} /> Nueva actividad
          </button>
        }
      />

      {stats.conflictCount > 0 && (
        <div className="conflict-alert" role="alert">
          <span className="conflict-alert-icon"><AlertTriangle size={22} /></span>
          <div>
            <strong>
              {stats.conflictCount === 1
                ? 'Hay 1 actividad con conflicto de horario'
                : `Hay ${stats.conflictCount} actividades con conflictos de horario`}
            </strong>
            <p>Revisa el calendario para ajustar los horarios superpuestos.</p>
          </div>
          <button
            type="button"
            className="button secondary small"
            onClick={() => navigate('/calendario')}
          >
            Ver calendario <ChevronRight size={16} />
          </button>
        </div>
      )}

      <section className="stat-grid" aria-label="Indicadores principales">
        <StatCard
          label="Total de actividades"
          value={stats.total}
          detail={`${stats.completionRate}% completadas`}
          icon={<ListTodo size={22} />}
          tone="tone-purple"
        />
        <StatCard
          label="Pendientes"
          value={stats.pending}
          detail={`${stats.todayPending} para hoy`}
          icon={<Circle size={22} />}
          tone="tone-amber"
        />
        <StatCard
          label="Completadas"
          value={stats.completed}
          detail={`${stats.completionRate}% de productividad`}
          icon={<CheckCircle2 size={22} />}
          tone="tone-green"
        />
        <StatCard
          label="Prioritarias"
          value={stats.highPriority}
          detail="Prioridad alta pendientes"
          icon={<Flag size={22} />}
          tone="tone-red"
        />
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Resumen del día</h2>
                <p>
                  {stats.todayCount === 0
                    ? 'Sin actividades programadas para hoy'
                    : `${stats.todayCount} ${stats.todayCount === 1 ? 'actividad' : 'actividades'} · ${stats.todayPending} pendientes`}
                </p>
              </div>
              <span className="header-icon"><CalendarDays size={19} /></span>
            </div>
            <TodayList activities={stats.todayActivities} onOpen={openDetail} />
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>Próximos 7 días</h2>
                <p>Distribución real de tus actividades</p>
              </div>
              <span className="header-icon"><TrendingUp size={19} /></span>
            </div>
            <WeeklyChart stats={stats} />
          </section>
        </div>

        <div className="dashboard-side">
          <section className="card productivity-card">
            <div className="card-header">
              <div>
                <h2>Productividad</h2>
                <p>Actividades completadas</p>
              </div>
              <span className="header-icon"><Sparkles size={19} /></span>
            </div>
            <div className="productivity-body">
              <ProgressRing value={stats.completionRate} label="Completado" />
              <div className="productivity-stats">
                <div>
                  <strong>{stats.completed}</strong>
                  <span>Completadas</span>
                </div>
                <div>
                  <strong>{stats.pending}</strong>
                  <span>Pendientes</span>
                </div>
                <div>
                  <strong>{stats.todayCount}</strong>
                  <span>Hoy</span>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>Próximas actividades</h2>
                <p>Las 5 pendientes más cercanas</p>
              </div>
              <span className="header-icon"><Clock3 size={19} /></span>
            </div>
            {stats.upcoming.length === 0 ? (
              <EmptyState
                compact
                icon={<Clock3 size={24} />}
                title="Sin actividades próximas"
                message="Crea una actividad para empezar a organizar tu tiempo."
                action={
                  <button type="button" className="button secondary small" onClick={() => openCreate()}>
                    <Plus size={16} /> Crear actividad
                  </button>
                }
              />
            ) : (
              <ul className="upcoming-list">
                {stats.upcoming.map((activity) => (
                  <li key={activity.id}>
                    <button
                      type="button"
                      className="upcoming-main"
                      onClick={() => openDetail(activity)}
                    >
                      <span className="upcoming-date">
                        <strong>{relativeDateLabel(activity.date)}</strong>
                        <small>{activity.startTime}</small>
                      </span>
                      <span className="upcoming-info">
                        <span className="upcoming-title">{activity.title}</span>
                        <span className="upcoming-meta">
                          <CategoryPill category={activity.category} subtle />
                          <PriorityBadge priority={activity.priority} />
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-button complete-button"
                      title="Marcar como completada"
                      aria-label={`Completar ${activity.title}`}
                      disabled={completing === activity.id}
                      onClick={() => void completeUpcoming(activity)}
                    >
                      <Check size={17} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>Distribución por categoría</h2>
                <p>Cómo se reparten tus actividades</p>
              </div>
              <span className="header-icon"><Flag size={19} /></span>
            </div>
            {stats.byCategory.length === 0 ? (
              <p className="card-empty-text">Aún no hay actividades para distribuir.</p>
            ) : (
              <ul className="category-bars">
                {stats.byCategory.map((entry) => {
                  const percent = stats.total > 0 ? Math.round((entry.count / stats.total) * 100) : 0
                  return (
                    <li key={entry.categoryId}>
                      <div className="category-bar-heading">
                        <span>
                          <span className="legend-dot" style={{ backgroundColor: entry.color }} />
                          {entry.name}
                        </span>
                        <strong>{entry.count} · {percent}%</strong>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${percent}%`, backgroundColor: entry.color }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
