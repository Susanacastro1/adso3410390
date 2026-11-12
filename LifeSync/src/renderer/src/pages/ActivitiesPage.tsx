import { useMemo, useState, type ReactElement } from 'react'
import {
  AlertTriangle,
  ArrowDownUp,
  CalendarDays,
  Check,
  Eye,
  ListTodo,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X
} from 'lucide-react'
import { formatDuration } from '@shared/domain/time'
import type {
  Activity,
  ActivityFilters,
  ActivityStatus,
  Priority
} from '@shared/types'
import { errorMessage, getApi, unwrap } from '../services/api'
import { useActivities } from '../hooks/useActivities'
import { useCategories } from '../hooks/useCategories'
import { useDataVersion } from '../context/DataVersionContext'
import { useActivityDialog } from '../context/ActivityDialogContext'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CategoryPill, ConflictBadge, PriorityBadge, StatusBadge } from '../components/ActivityBadges'
import { useToast } from '../components/Toast'
import {
  formatEntryDate,
  formatShortDate,
  relativeDateLabel
} from '../utils/date'

export function ActivitiesPage(): ReactElement {
  const toast = useToast()
  const { bump } = useDataVersion()
  const { openCreate, openEdit, openDetail } = useActivityDialog()
  const categories = useCategories()

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<'asc' | 'desc'>('asc')
  const [deleting, setDeleting] = useState<Activity | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const filters = useMemo<ActivityFilters>(
    () => ({
      search: search.trim() || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      priority: (priority as Priority | '') || undefined,
      status: (status as ActivityStatus | '') || undefined,
      from: from || undefined,
      to: to || undefined,
      sort
    }),
    [search, categoryId, priority, status, from, to, sort]
  )

  const activities = useActivities(filters)
  const hasFilters = Boolean(search || categoryId || priority || status || from || to)

  const groups = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const activity of activities.data ?? []) {
      const list = map.get(activity.date) ?? []
      list.push(activity)
      map.set(activity.date, list)
    }
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }))
  }, [activities.data])

  function clearFilters(): void {
    setSearch('')
    setCategoryId('')
    setPriority('')
    setStatus('')
    setFrom('')
    setTo('')
    setSort('asc')
  }

  async function toggleStatus(activity: Activity): Promise<void> {
    if (busyId !== null) return
    setBusyId(activity.id)
    try {
      const next: ActivityStatus =
        activity.status === 'pendiente' ? 'completada' : 'pendiente'
      await unwrap(getApi().activities.setStatus(activity.id, next))
      toast.success(
        next === 'completada'
          ? 'Actividad marcada como completada.'
          : 'Actividad marcada como pendiente.'
      )
      bump()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await unwrap(getApi().activities.remove(deleting.id))
      toast.success('Actividad eliminada correctamente.')
      setDeleting(null)
      bump()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDeleteBusy(false)
    }
  }

  const total = activities.data?.length ?? 0

  return (
    <>
      <PageHeader
        eyebrow="Planificación"
        title="Mis actividades"
        subtitle="Consulta, filtra y administra todas tus actividades registradas."
        actions={
          <button type="button" className="button primary" onClick={() => openCreate()}>
            <Plus size={18} /> Nueva actividad
          </button>
        }
      />

      <section className="card filter-card" aria-label="Filtros de actividades">
        <div className="search-field">
          <Search size={18} />
          <input
            type="search"
            value={search}
            placeholder="Buscar por título o descripción…"
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar actividades"
          />
          {search && (
            <button type="button" className="clear-search" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="filter-row">
          <label className="filter-control">
            <span>Categoría</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Todas</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-control">
            <span>Prioridad</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="">Todas</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </label>

          <label className="filter-control">
            <span>Estado</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="completada">Completada</option>
            </select>
          </label>

          <label className="filter-control">
            <span>Desde</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>

          <label className="filter-control">
            <span>Hasta</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>

          <div className="filter-actions">
            <button
              type="button"
              className="button secondary small"
              onClick={() => setSort((current) => (current === 'asc' ? 'desc' : 'asc'))}
              title="Cambiar orden por fecha y hora"
            >
              <ArrowDownUp size={16} />
              {sort === 'asc' ? 'Ascendente' : 'Descendente'}
            </button>
            {hasFilters && (
              <button type="button" className="button ghost small" onClick={clearFilters}>
                <X size={16} /> Limpiar
              </button>
            )}
          </div>
        </div>
      </section>

      {activities.loading && !activities.data ? (
        <PageSkeleton rows={5} />
      ) : activities.error ? (
        <div className="card error-panel">
          <AlertTriangle size={22} />
          <div>
            <strong>No se pudieron cargar las actividades</strong>
            <p>{activities.error}</p>
          </div>
          <button type="button" className="button secondary" onClick={activities.reload}>
            Reintentar
          </button>
        </div>
      ) : total === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ListTodo size={30} />}
            title={hasFilters ? 'No hay resultados' : 'Todavía no hay actividades'}
            message={
              hasFilters
                ? 'Prueba con otros filtros o limpia la búsqueda para ver todas tus actividades.'
                : 'Registra tu primera actividad y empieza a organizar tu día.'
            }
            action={
              hasFilters ? (
                <button type="button" className="button secondary" onClick={clearFilters}>
                  Limpiar filtros
                </button>
              ) : (
                <button type="button" className="button primary" onClick={() => openCreate()}>
                  <Plus size={18} /> Crear primera actividad
                </button>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="list-summary">
            <span>
              <strong>{total}</strong> {total === 1 ? 'actividad' : 'actividades'}
              {hasFilters ? ' con los filtros aplicados' : ' registradas'}
            </span>
            <span className="muted">
              Orden {sort === 'asc' ? 'ascendente' : 'descendente'}
            </span>
          </div>

          <div className="activity-groups">
            {groups.map((group) => (
              <section key={group.date} className="activity-group">
                <div className="group-header">
                  <div>
                    <h2>{relativeDateLabel(group.date)}</h2>
                    <span>
                      {formatEntryDate(group.date)} · {formatShortDate(group.date)}
                    </span>
                  </div>
                  <span className="group-count">
                    {group.items.length} {group.items.length === 1 ? 'actividad' : 'actividades'}
                  </span>
                </div>

                <div className="activity-table" role="table" aria-label={`Actividades del ${group.date}`}>
                  <div className="activity-table-head" role="row">
                    <span role="columnheader">Actividad</span>
                    <span role="columnheader">Horario</span>
                    <span role="columnheader">Categoría</span>
                    <span role="columnheader">Prioridad</span>
                    <span role="columnheader">Estado</span>
                    <span role="columnheader" className="align-right">Acciones</span>
                  </div>

                  {group.items.map((activity) => (
                    <div
                      key={activity.id}
                      className={`activity-row ${activity.status === 'completada' ? 'is-completed' : ''}`}
                      role="row"
                    >
                      <div className="activity-main-cell" role="cell">
                        <span
                          className="activity-color"
                          style={{ backgroundColor: activity.category.color }}
                          aria-hidden="true"
                        />
                        <div>
                          <button
                            type="button"
                            className="activity-title-button"
                            onClick={() => openDetail(activity)}
                          >
                            {activity.title}
                          </button>
                          <p>
                            {activity.description || 'Sin descripción'}
                            {activity.conflictIds.length > 0 && (
                              <ConflictBadge count={activity.conflictIds.length} />
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="activity-time-cell" role="cell">
                        <strong>{activity.startTime} – {activity.endTime}</strong>
                        <span>{formatDuration(activity.duration)}</span>
                      </div>

                      <div role="cell" data-label="Categoría">
                        <CategoryPill category={activity.category} subtle />
                      </div>

                      <div role="cell" data-label="Prioridad">
                        <PriorityBadge priority={activity.priority} />
                      </div>

                      <div role="cell" data-label="Estado">
                        <StatusBadge status={activity.status} />
                      </div>

                      <div className="row-actions" role="cell">
                        <button
                          type="button"
                          className={`icon-button ${activity.status === 'completada' ? 'success' : ''}`}
                          title={activity.status === 'completada' ? 'Marcar pendiente' : 'Marcar completada'}
                          aria-label={
                            activity.status === 'completada'
                              ? `Marcar ${activity.title} como pendiente`
                              : `Completar ${activity.title}`
                          }
                          disabled={busyId === activity.id}
                          onClick={() => void toggleStatus(activity)}
                        >
                          {activity.status === 'completada' ? <RotateCcw size={17} /> : <Check size={17} />}
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title="Ver detalle"
                          aria-label={`Ver detalle de ${activity.title}`}
                          onClick={() => openDetail(activity)}
                        >
                          <Eye size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title="Editar"
                          aria-label={`Editar ${activity.title}`}
                          onClick={() => openEdit(activity)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          title="Eliminar"
                          aria-label={`Eliminar ${activity.title}`}
                          onClick={() => setDeleting(activity)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar actividad"
        message={`¿Seguro que quieres eliminar “${deleting?.title ?? ''}”? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
