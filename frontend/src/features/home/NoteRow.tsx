import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { NoteRead } from '../../api/types'
import { useSetNoteStatus } from '../../api/queries'
import { categoryColor } from '../calendar/colors'
import './home.css'

export function NoteRow({ note, time, overdue = false }: { note: NoteRead; time?: string; overdue?: boolean }) {
  const { t } = useTranslation()
  const setStatus = useSetNoteStatus()
  const done = note.status === 'done'
  const classes = ['home-row']
  if (time !== undefined) classes.push('timed')
  if (done) classes.push('done')
  return (
    <li className={classes.join(' ')}>
      {time !== undefined && <span className={overdue ? 'home-time overdue' : 'home-time'}>{time}</span>}
      {note.status !== null ? (
        <input
          type="checkbox"
          className="home-check"
          aria-label={t('notes.markDone', { title: note.title })}
          checked={done}
          onChange={(e) => setStatus.mutate({ id: note.id, status: e.target.checked ? 'done' : 'todo' })}
        />
      ) : (
        <span className="home-dot" aria-hidden="true" />
      )}
      <div className="home-body">
        <Link to="/notes/$noteId" params={{ noteId: note.id }} className="home-title">
          {note.title}
        </Link>
        {(note.status === 'in_progress' || note.categories.length > 0) && (
          <div className="home-meta">
            {note.status === 'in_progress' && <span className="home-prog">{t('status.in_progress')}</span>}
            {note.categories.map((c) => (
              <span key={c.id} className="home-tag" style={{ '--tag-color': categoryColor(c.id) } as CSSProperties}>
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}
