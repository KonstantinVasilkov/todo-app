import { noteStatusFilterValues, type ListNotesParams, type StatusFilter } from '../../api/types'
import { localDayRange, todayKey } from '../../lib/dates'
import { OPEN_STATUSES } from './status'

export type DueFilter = 'today' | 'overdue' | 'none'

export interface NotesSearch {
  status?: StatusFilter[]
  category?: string[]
  due?: DueFilter
  from?: string
  to?: string
}

const DUE_FILTERS: readonly DueFilter[] = ['today', 'overdue', 'none']
const DAY = /^\d{4}-\d{2}-\d{2}$/

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value]
}

export function parseNotesSearch(raw: Record<string, unknown>): NotesSearch {
  const search: NotesSearch = {}
  const status = list(raw.status).filter((s): s is StatusFilter => noteStatusFilterValues.includes(s as StatusFilter))
  const category = list(raw.category).filter((c): c is string => typeof c === 'string')
  if (status.length) search.status = status
  if (category.length) search.category = category
  if (DUE_FILTERS.includes(raw.due as DueFilter)) search.due = raw.due as DueFilter
  if (typeof raw.from === 'string' && DAY.test(raw.from)) search.from = raw.from
  if (typeof raw.to === 'string' && DAY.test(raw.to)) search.to = raw.to
  return search
}

export function toListParams(search: NotesSearch, now: Date): ListNotesParams {
  const params: ListNotesParams = {}
  if (search.status) params.status = search.status
  if (search.category) params.category_id = search.category

  switch (search.due) {
    case 'today': {
      const { from, to } = localDayRange(todayKey(now))
      params.due_from = from
      params.due_to = to
      break
    }
    case 'overdue':
      params.status ??= OPEN_STATUSES
      params.due_to = now.toISOString()
      break
    case 'none':
      params.has_due = false
      break
    default:
      if (search.from) params.due_from = localDayRange(search.from).from
      if (search.to) params.due_to = localDayRange(search.to).to
  }
  return params
}
