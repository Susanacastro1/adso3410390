import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { dateToISO, todayISO } from '@shared/domain/time'
import type { WeekStart } from '@shared/types'

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatLongDate(value: string): string {
  return capitalize(format(parseLocalDate(value), "EEEE d 'de' MMMM 'de' yyyy", { locale: es }))
}

export function formatShortDate(value: string): string {
  return format(parseLocalDate(value), 'd MMM', { locale: es })
}

export function formatWeekday(value: string): string {
  return capitalize(format(parseLocalDate(value), 'EEEE', { locale: es }))
}

export function formatMonthTitle(value: string): string {
  return capitalize(format(parseLocalDate(value), 'MMMM yyyy', { locale: es }))
}

export function relativeDateLabel(value: string): string {
  const today = todayISO()
  const tomorrow = dateToISO(addDays(parseLocalDate(today), 1))
  const yesterday = dateToISO(addDays(parseLocalDate(today), -1))
  if (value === today) return 'Hoy'
  if (value === tomorrow) return 'Mañana'
  if (value === yesterday) return 'Ayer'
  return capitalize(format(parseLocalDate(value), "EEEE d 'de' MMMM", { locale: es }))
}

export function formatEntryDate(value: string): string {
  return capitalize(format(parseLocalDate(value), "EEE d MMM", { locale: es }))
}

export function formatMonthDay(value: string): string {
  return format(parseLocalDate(value), 'd MMM', { locale: es })
}

export function greetingForHour(hour = new Date().getHours()): string {
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function addDaysISO(value: string, days: number): string {
  return dateToISO(addDays(parseLocalDate(value), days))
}

export function nowTimeRounded(): string {
  const now = new Date()
  const minutes = now.getMinutes()
  const rounded = minutes < 30 ? 30 : 60
  now.setMinutes(rounded, 0, 0)
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function weekStartsOnNumber(value: WeekStart): 0 | 1 {
  return value === 'sunday' ? 0 : 1
}

export function getWeekDays(anchor: Date, weekStart: WeekStart): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: weekStartsOnNumber(weekStart) })
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function getMonthGrid(anchor: Date, weekStart: WeekStart): Date[] {
  const first = startOfMonth(anchor)
  const last = endOfMonth(anchor)
  const gridStart = startOfWeek(first, { weekStartsOn: weekStartsOnNumber(weekStart) })
  const gridEnd = endOfWeek(last, { weekStartsOn: weekStartsOnNumber(weekStart) })
  const days: Date[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}

export function getWeekdayLabels(weekStart: WeekStart): string[] {
  const monday = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const sunday = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return weekStart === 'sunday' ? sunday : monday
}

export function formatWeekRange(anchor: Date, weekStart: WeekStart): string {
  const days = getWeekDays(anchor, weekStart)
  const first = days[0]
  const last = days[6]
  const sameMonth = first.getMonth() === last.getMonth()
  const firstLabel = format(first, sameMonth ? 'd' : 'd MMM', { locale: es })
  const lastLabel = format(last, "d MMM yyyy", { locale: es })
  return `${capitalize(firstLabel)} – ${lastLabel}`
}

export function formatDateFromDate(date: Date): string {
  return capitalize(format(date, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }))
}

export function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return capitalize(format(date, "d MMM yyyy, HH:mm", { locale: es }))
}

export function formatTimeRange(start: string, end: string): string {
  return `${start} – ${end}`
}

export function formatDayNumber(value: Date): string {
  return format(value, 'd')
}

export function formatMonthShort(value: Date): string {
  return format(value, 'MMM', { locale: es }).replace('.', '')
}

export function isSameISODate(value: string, date: Date): boolean {
  return value === dateToISO(date)
}
