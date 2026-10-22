import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { NoteRead, NoteStatus } from '../../api/types'
import { formatDue } from '../../lib/dates'
import { isOverdue } from './status'

export function NoteItem({
  note,
  now,
  onStatusChange,
}: {
  note: NoteRead
  now: Date
  onStatusChange: (status: NoteStatus) => void
}) {
  const { t, i18n } = useTranslation()
  const done = note.status === 'done'
  return (
    <li className={done ? 'note-item done' : 'note-item'}>
      {note.status !== null ? (
        <input
          type="checkbox"
          className="note-check"
          aria-label={t('notes.markDone', { title: note.title })}
          checked={done}
          onChange={(e) => onStatusChange(e.target.checked ? 'done' : 'todo')}
        />
      ) : (
        <span className="note-marker" aria-hidden="true" />
      )}
      <div className="note-content">
        <Link to="/notes/$noteId" params={{ noteId: note.id }} className="note-title">
          {note.title}
        </Link>
        <div className="note-meta">
          {note.status === 'in_progress' && <span className="badge">{t('status.in_progress')}</span>}
          {note.due && <span className={isOverdue(note, now) ? 'due overdue' : 'due'}>{formatDue(note.due, now, i18n.resolvedLanguage ?? 'en')}</span>}
          {note.categories.map((c) => (
            <span key={c.id} className="chip">
              {c.name}
            </span>
          ))}
        </div>
      </div>
    </li>
  )
}
