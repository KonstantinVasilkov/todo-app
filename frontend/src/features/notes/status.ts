import { noteStatusValues, type NoteRead, type NoteStatus } from '../../api/types'

const IS_OPEN: Record<NoteStatus, boolean> = { todo: true, in_progress: true, done: false }

export const OPEN_STATUSES: NoteStatus[] = noteStatusValues.filter((status) => IS_OPEN[status])

export function isOverdue(note: NoteRead, now: Date): boolean {
  const open = note.status !== null && IS_OPEN[note.status]
  return open && note.due !== null && Date.parse(note.due) < now.getTime()
}
