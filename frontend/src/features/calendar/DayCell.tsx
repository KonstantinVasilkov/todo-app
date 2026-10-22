import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { NoteRead } from '../../api/types'
import { dateOf, dueFromISO, minutesOfDay } from '../../lib/dates'
import { isOverdue } from '../notes/status'
import { noteColor } from './colors'
import type { CalendarDay } from './grid'
import { layoutCell, positionOf, type CellArea } from './layout'

interface DayCellProps {
  day: CalendarDay
  notes: NoteRead[]
  area: CellArea
  height: number
  today: boolean
  showTime: boolean
  now: Date
  locale: string
}

export function DayCell({ day, notes, area, height, today, showTime, now, locale }: DayCellProps) {
  const { t } = useTranslation()
  const navigate = useNavigate({ from: '/' })
  const date = dateOf(day.key)
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date)
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
  const layout = layoutCell(
    notes.map((note) => ({ id: note.id, minutes: minutesOfDay(note.due ?? '') })),
    area,
  )
  const byId = new Map(notes.map((note) => [note.id, note]))
  const classes = ['cal-day']
  if (!day.inMonth) classes.push('is-outside')
  if (day.weekend) classes.push('is-weekend')
  if (today) classes.push('is-today')

  return (
    <div className={classes.join(' ')} data-day={day.key} style={{ height }}>
      <button
        type="button"
        className="cal-add"
        aria-label={t('calendar.addNote', { date: fullDate })}
        onClick={() => void navigate({ to: '/notes/new', search: { date: day.key } })}
      />
      <span className="cal-num" aria-current={today ? 'date' : undefined}>
        {date.getDate()}
      </span>
      {layout.rows.map((row) => {
        const note = byId.get(row.id)
        if (!note || !note.due) return null
        const { time } = dueFromISO(note.due)
        const classNames = ['cal-event']
        if (note.status === 'done') classNames.push('is-done')
        if (isOverdue(note, now)) classNames.push('is-overdue')
        return (
          <Link
            key={note.id}
            to="/notes/$noteId"
            params={{ noteId: note.id }}
            className={classNames.join(' ')}
            title={note.title}
            style={{ top: row.top, height: area.rowHeight, ['--event-color' as string]: noteColor(note) ?? 'var(--muted)' }}
          >
            {showTime && time ? <span className="cal-time">{timeFormat.format(new Date(note.due))}</span> : null}
            <span className="cal-title">{note.title}</span>
          </Link>
        )
      })}
      {layout.more ? (
        <button
          type="button"
          className="cal-more"
          style={{ top: layout.more.top, height: area.rowHeight }}
          onClick={() => void navigate({ search: (prev) => ({ ...prev, view: 'week', date: day.key }) })}
        >
          {t('calendar.more', { hidden: layout.more.count })}
        </button>
      ) : null}
      {today ? (
        <div
          className="cal-now"
          role="img"
          aria-label={t('calendar.now')}
          style={{ top: positionOf(now.getHours() * 60 + now.getMinutes(), area) }}
        />
      ) : null}
    </div>
  )
}
