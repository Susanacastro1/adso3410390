import { useState, type ReactElement } from 'react'
import {
  AlertTriangle,
  Layers,
  Pencil,
  Plus,
  Tag,
  Tags,
  Trash2
} from 'lucide-react'
import type { Category } from '@shared/types'
import { errorMessage, getApi, unwrap } from '../services/api'
import { useCategories } from '../hooks/useCategories'
import { useDataVersion } from '../context/DataVersionContext'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CategoryFormModal } from '../components/CategoryFormModal'
import { useToast } from '../components/Toast'
import { hexToRgba } from '../utils/colors'

export function CategoriesPage(): ReactElement {
  const toast = useToast()
  const { bump } = useDataVersion()
  const categories = useCategories()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [destination, setDestination] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  const data = categories.data ?? []
  const totalActivities = data.reduce((sum, category) => sum + category.activityCount, 0)
  const mostUsed = [...data].sort((a, b) => b.activityCount - a.activityCount)[0]

  function openCreate(): void {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(category: Category): void {
    setEditing(category)
    setFormOpen(true)
  }

  function askDelete(category: Category): void {
    setDeleting(category)
    const other =
      data.find((item) => item.name.toLocaleLowerCase('es') === 'otros' && item.id !== category.id) ??
      data.find((item) => item.id !== category.id)
    setDestination(other ? String(other.id) : '')
  }

  async function confirmDelete(): Promise<void> {
    if (!deleting) return
    if (deleting.activityCount > 0 && !destination) {
      toast.error('Selecciona una categoría de destino para reasignar las actividades.')
      return
    }
    setDeleteBusy(true)
    try {
      await unwrap(
        getApi().categories.remove(
          deleting.id,
          deleting.activityCount > 0 ? Number(destination) : undefined
        )
      )
      toast.success('Categoría eliminada correctamente.')
      setDeleting(null)
      bump()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDeleteBusy(false)
    }
  }

  const isProtected = (category: Category): boolean =>
    category.name.toLocaleLowerCase('es') === 'otros'

  const destinationOptions = data.filter((item) => item.id !== deleting?.id)

  return (
    <>
      <PageHeader
        eyebrow="Organización"
        title="Categorías"
        subtitle="Clasifica tus actividades y distínguelas con colores en todo LifeSync."
        actions={
          <button type="button" className="button primary" onClick={openCreate}>
            <Plus size={18} /> Nueva categoría
          </button>
        }
      />

      <section className="category-stats" aria-label="Resumen de categorías">
        <article className="mini-stat">
          <span className="mini-stat-icon"><Tags size={19} /></span>
          <div>
            <strong>{data.length}</strong>
            <span>Categorías</span>
          </div>
        </article>
        <article className="mini-stat">
          <span className="mini-stat-icon"><Layers size={19} /></span>
          <div>
            <strong>{totalActivities}</strong>
            <span>Actividades clasificadas</span>
          </div>
        </article>
        <article className="mini-stat">
          <span className="mini-stat-icon"><Tag size={19} /></span>
          <div>
            <strong>{mostUsed?.name ?? '—'}</strong>
            <span>{mostUsed ? `Más usada · ${mostUsed.activityCount}` : 'Sin actividad'}</span>
          </div>
        </article>
      </section>

      {categories.loading && !categories.data ? (
        <PageSkeleton rows={3} />
      ) : categories.error ? (
        <div className="card error-panel">
          <AlertTriangle size={22} />
          <div>
            <strong>No se pudieron cargar las categorías</strong>
            <p>{categories.error}</p>
          </div>
          <button type="button" className="button secondary" onClick={categories.reload}>
            Reintentar
          </button>
        </div>
      ) : data.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Tags size={30} />}
            title="No hay categorías"
            message="Crea una categoría para clasificar tus actividades."
            action={
              <button type="button" className="button primary" onClick={openCreate}>
                <Plus size={18} /> Crear categoría
              </button>
            }
          />
        </div>
      ) : (
        <div className="category-grid">
          {data.map((category) => {
            const percent = totalActivities > 0 ? (category.activityCount / totalActivities) * 100 : 0
            return (
              <article
                key={category.id}
                className="category-card"
                style={{ borderTopColor: category.color }}
              >
                <div
                  className="category-card-glow"
                  style={{ backgroundColor: hexToRgba(category.color, 0.12) }}
                />
                <div className="category-card-head">
                  <span
                    className="category-swatch"
                    style={{ backgroundColor: category.color }}
                  >
                    <Tag size={18} />
                  </span>
                  <div>
                    <h2>{category.name}</h2>
                    <span className="category-count">
                      {category.activityCount}{' '}
                      {category.activityCount === 1 ? 'actividad' : 'actividades'}
                    </span>
                  </div>
                  {category.isDefault && <span className="default-badge">Predeterminada</span>}
                </div>

                <div className="category-progress">
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${percent}%`, backgroundColor: category.color }}
                    />
                  </div>
                  <span>{Math.round(percent)}% del total</span>
                </div>

                <div className="category-card-footer">
                  <span className="category-color-code">{category.color.toUpperCase()}</span>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-button"
                      title="Editar categoría"
                      aria-label={`Editar ${category.name}`}
                      onClick={() => openEdit(category)}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger"
                      title={
                        isProtected(category)
                          ? 'La categoría Otros no se puede eliminar'
                          : 'Eliminar categoría'
                      }
                      aria-label={`Eliminar ${category.name}`}
                      disabled={isProtected(category)}
                      onClick={() => askDelete(category)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {formOpen && (
        <CategoryFormModal
          key={editing?.id ?? 'new'}
          open
          category={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            bump()
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar categoría"
        message={
          deleting && deleting.activityCount > 0
            ? `“${deleting.name}” tiene ${deleting.activityCount} ${deleting.activityCount === 1 ? 'actividad' : 'actividades'} asociadas. Para eliminarla, elige la categoría que las recibirá.`
            : `¿Seguro que quieres eliminar “${deleting?.name ?? ''}”? Esta acción no se puede deshacer.`
        }
        confirmLabel="Eliminar"
        danger
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      >
        {deleting && deleting.activityCount > 0 && (
          <label className="form-field full reassign-field">
            <span>Reasignar actividades a</span>
            <select
              className="input"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              <option value="" disabled>
                Selecciona una categoría
              </option>
              {destinationOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </ConfirmDialog>
    </>
  )
}
