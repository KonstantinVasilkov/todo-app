import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useNotesDue } from '../../api/queries'
import type { NoteRead } from '../../api/types'
import { dueFromISO, localDayRange, todayKey } from '../../lib/dates'
import { useNow } from '../../lib/useNow'
import { NoteRow } from './NoteRow'
import './home.css'

export function TodayList() {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'en'
  const now = useNow()
  const range = localDayRange(todayKey(now))
  const { data } = useNotesDue(range.from, range.to)
  const headingId = useId()
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
  const subtitle = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(now)

  const isTimed = (n: NoteRead) => n.due !== null && dueFromISO(n.due).time !== ''
  const items = [...(data ?? [])].sort((a, b) => {
    const ta = isTimed(a)
    const tb = isTimed(b)
    if (ta !== tb) return ta ? -1 : 1
    return new Date(a.due ?? 0).getTime() - new Date(b.due ?? 0).getTime()
  })
  const pastCount = items.filter((n) => isTimed(n) && new Date(n.due as string).getTime() <= now.getTime()).length

  const rows = items.map((n, i) => {
    const timed = isTimed(n)
    const past = i < pastCount
    return (
      <NoteRow
        key={n.id}
        note={n}
        time={timed ? timeFormat.format(new Date(n.due as string)) : t('today.allDay')}
        overdue={timed && past && n.status !== 'done'}
      />
    )
  })
  const nowLine = (
    <li key="now" className="home-now" aria-label={t('calendar.now')}>
      <span>{timeFormat.format(now)}</span>
    </li>
  )
  if (items.length > 0) rows.splice(pastCount, 0, nowLine)

  return (
    <section className="home-card" aria-labelledby={headingId}>
      <h2 id={headingId} className="home-card-title">
        {t('today.title')}
        <span className="home-count">{items.length}</span>
      </h2>
      <p className="home-sub">{subtitle}</p>
      {items.length === 0 ? <p className="home-empty">{t('today.empty')}</p> : <ul className="home-list">{rows}</ul>}
    </section>
  )
}
