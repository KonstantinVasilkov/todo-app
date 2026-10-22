import { dateKey, dateOf } from '../../lib/dates'
import type { CalendarView } from './grid'

export interface HomeSearch {
  view?: CalendarView
  date?: string
}

export interface NewNoteSearch {
  date?: string
}

const VIEWS: readonly CalendarView[] = ['month', 'week']

function validDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(dateOf(value)) === value
}

export function parseHomeSearch(raw: Record<string, unknown>): HomeSearch {
  const search: HomeSearch = {}
  if (VIEWS.includes(raw.view as CalendarView)) search.view = raw.view as CalendarView
  if (validDay(raw.date)) search.date = raw.date
  return search
}

export function parseNewNoteSearch(raw: Record<string, unknown>): NewNoteSearch {
  return validDay(raw.date) ? { date: raw.date } : {}
}
