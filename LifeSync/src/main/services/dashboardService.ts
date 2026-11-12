import type { Database } from 'better-sqlite3'
import { findAllConflictIds } from '@shared/domain/conflicts'
import { dateToISO, todayISO } from '@shared/domain/time'
import type { DashboardStats } from '@shared/types'
import { listActivities } from '../repositories/activitiesRepository'
import { listCategories } from '../repositories/categoriesRepository'

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  return dateToISO(new Date(year, month - 1, day + days))
}

export function getDashboardStats(db: Database): DashboardStats {
  const all = listActivities(db, {})
  const today = todayISO()

  const pending = all.filter((activity) => activity.status === 'pendiente')
  const completed = all.filter((activity) => activity.status === 'completada')
  const highPriority = pending.filter((activity) => activity.priority === 'alta')
  const todayActivities = all.filter((activity) => activity.date === today)
  const conflictIds = findAllConflictIds(all)

  const upcoming = pending
    .filter((activity) => activity.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 5)

  const weekBars = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index)
    const [year, month, day] = date.split('-').map(Number)
    const label = new Date(year, month - 1, day).toLocaleDateString('es-ES', { weekday: 'short' })
    return {
      date,
      label: label.replace('.', ''),
      count: all.filter((activity) => activity.date === date).length
    }
  })

  const categories = listCategories(db)
  const byCategory = categories
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      color: category.color,
      count: all.filter((activity) => activity.categoryId === category.id).length
    }))
    .filter((entry) => entry.count > 0)

  return {
    total: all.length,
    pending: pending.length,
    completed: completed.length,
    highPriority: highPriority.length,
    todayCount: todayActivities.length,
    todayPending: todayActivities.filter((activity) => activity.status === 'pendiente').length,
    completionRate: all.length > 0 ? Math.round((completed.length / all.length) * 100) : 0,
    upcoming,
    todayActivities,
    weekBars,
    byCategory,
    conflictCount: conflictIds.size
  }
}
