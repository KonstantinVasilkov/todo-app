import type { NoteCreate, NoteRead, NoteUpdate, StatusFilter } from '../../api/types'
import { dueFromISO, dueToISO } from '../../lib/dates'

export interface NoteFormValues {
  title: string
  body: string
  dueDate: string
  dueTime: string
  status: StatusFilter
  categoryIds: string[]
}

export const emptyNoteForm: NoteFormValues = {
  title: '',
  body: '',
  dueDate: '',
  dueTime: '',
  status: 'todo',
  categoryIds: [],
}

function normalize(values: NoteFormValues) {
  return {
    title: values.title.trim(),
    body: values.body.trim() ? values.body : null,
    due: dueToISO(values.dueDate, values.dueTime),
    status: values.status === 'none' ? null : values.status,
  }
}

function sameInstant(a: string | null, b: string | null): boolean {
  return a === null || b === null ? a === b : Date.parse(a) === Date.parse(b)
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}

export function formFromNote(note: NoteRead): NoteFormValues {
  const { date, time } = dueFromISO(note.due)
  return {
    title: note.title,
    body: note.body ?? '',
    dueDate: date,
    dueTime: time,
    status: note.status ?? 'none',
    categoryIds: note.categories.map((c) => c.id),
  }
}

export function toNoteCreate(values: NoteFormValues): NoteCreate {
  const { title, body, due, status } = normalize(values)
  const create: NoteCreate = { title, status, category_ids: values.categoryIds }
  if (body !== null) create.body = body
  if (due !== null) create.due = due
  return create
}

export function toNoteUpdate(note: NoteRead, values: NoteFormValues): NoteUpdate {
  const { title, body, due, status } = normalize(values)
  const update: NoteUpdate = {}
  if (title !== note.title) update.title = title
  if (body !== note.body) update.body = body
  if (!sameInstant(due, note.due)) update.due = due
  if (status !== note.status) update.status = status
  const categoryIds = note.categories.map((c) => c.id)
  if (!sameSet(values.categoryIds, categoryIds)) update.category_ids = values.categoryIds
  return update
}
