import type { Database } from 'better-sqlite3'
import type { Category } from '@shared/types'
import { AppError } from '../errors'

interface CategoryRow {
  id: number
  name: string
  color: string
  is_default: number
  created_at: string
  activity_count: number
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    activityCount: row.activity_count
  }
}

const SELECT_CATEGORY = `
  SELECT c.*, COUNT(a.id) AS activity_count
  FROM categories c
  LEFT JOIN activities a ON a.category_id = c.id
`

export function listCategories(db: Database): Category[] {
  const rows = db
    .prepare(`${SELECT_CATEGORY} GROUP BY c.id ORDER BY c.id ASC`)
    .all() as CategoryRow[]
  return rows.map(mapCategory)
}

export function getCategory(db: Database, id: number): Category | null {
  const row = db
    .prepare(`${SELECT_CATEGORY} WHERE c.id = ? GROUP BY c.id`)
    .get(id) as CategoryRow | undefined
  return row ? mapCategory(row) : null
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function findCategoryByName(db: Database, name: string): Category | null {
  const target = normalizeName(name)
  const rows = db.prepare(`${SELECT_CATEGORY} GROUP BY c.id`).all() as CategoryRow[]
  const found = rows.find((row) => normalizeName(row.name) === target)
  return found ? mapCategory(found) : null
}

export function createCategory(
  db: Database,
  input: { name: string; color: string }
): Category {
  const name = input.name.trim()
  if (findCategoryByName(db, name)) {
    throw new AppError('DUPLICATE_CATEGORY', `Ya existe una categoría llamada "${name}"`)
  }

  const result = db
    .prepare('INSERT INTO categories (name, color, is_default, created_at) VALUES (?, ?, 0, ?)')
    .run(name, input.color, new Date().toISOString())

  return getCategory(db, Number(result.lastInsertRowid)) as Category
}

export function updateCategory(
  db: Database,
  id: number,
  input: { name: string; color: string }
): Category {
  const current = getCategory(db, id)
  if (!current) throw new AppError('NOT_FOUND', 'La categoría no existe')

  const name = input.name.trim()
  const duplicate = findCategoryByName(db, name)
  if (duplicate && duplicate.id !== id) {
    throw new AppError('DUPLICATE_CATEGORY', `Ya existe una categoría llamada "${name}"`)
  }

  db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(name, input.color, id)
  return getCategory(db, id) as Category
}

export function deleteCategory(db: Database, id: number, reassignTo?: number): void {
  const category = getCategory(db, id)
  if (!category) throw new AppError('NOT_FOUND', 'La categoría no existe')

  if (category.name.toLocaleLowerCase('es') === 'otros') {
    throw new AppError('CATEGORY_PROTECTED', 'La categoría "Otros" no se puede eliminar')
  }

  if (category.activityCount > 0) {
    if (!reassignTo) {
      throw new AppError('CATEGORY_IN_USE', 'La categoría tiene actividades asociadas', {
        activityCount: category.activityCount
      })
    }
    if (reassignTo === id) {
      throw new AppError('VALIDATION_ERROR', 'La categoría destino debe ser diferente')
    }
    const destination = getCategory(db, reassignTo)
    if (!destination) throw new AppError('NOT_FOUND', 'La categoría destino no existe')

    const transaction = db.transaction(() => {
      db.prepare('UPDATE activities SET category_id = ?, updated_at = ? WHERE category_id = ?').run(
        reassignTo,
        new Date().toISOString(),
        id
      )
      db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    })
    transaction()
    return
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
}

export function ensureFallbackCategory(db: Database): Category {
  const existing = findCategoryByName(db, 'Otros')
  if (existing) return existing
  return createCategory(db, { name: 'Otros', color: '#777777' })
}
