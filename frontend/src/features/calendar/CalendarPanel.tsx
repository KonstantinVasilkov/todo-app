import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useNotesDue } from '../../api/queries'
import type { NoteRead } from '../../api/types'
import { dateOf, dayKeyOf, todayKey } from '../../lib/dates'
import { useNow } from '../../lib/useNow'
import './calendar.css'
import { DayCell } from './DayCell'
import { dayRange, firstDayOfWeek, monthDays, shiftAnchor, weekDays, type CalendarView } from './grid'
import { MONTH_AREA, MONTH_CELL_HEIGHT, WEEK_AREA, WEEK_CELL_HEIGHT } from './geometry'

const homeRoute = getRouteApi('/_app/')
const VIEWS: CalendarView[] = ['month', 'week']

export function CalendarPanel() {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'en'
  const search = homeRoute.useSearch()
  const navigate = useNavigate({ from: '/' })
  const now = useNow()
  const today = todayKey(now)
  const view: CalendarView = search.view ?? 'month'
  const anchor = search.date ?? today
  const firstDay = firstDayOfWeek(locale)
  const days = view === 'week' ? weekDays(anchor, firstDay) : monthDays(anchor, firstDay)
  const range = dayRange(days)
  const { data } = useNotesDue(range.from, range.to)

  const byDay = new Map<string, NoteRead[]>()
  for (const note of data ?? []) {
    if (!note.due) continue
    const key = dayKeyOf(note.due)
    byDay.set(key, [...(byDay.get(key) ?? []), note])
  }

  const first = dateOf(days[0].key)
  const last = dateOf(days[days.length - 1].key)
  const title =
    view === 'week'
      ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).formatRange(first, last)
      : new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(dateOf(anchor))
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const area = view === 'week' ? WEEK_AREA : MONTH_AREA
  const height = view === 'week' ? WEEK_CELL_HEIGHT : MONTH_CELL_HEIGHT

  const go = (step: 1 | -1) =>
    void navigate({ search: (prev) => ({ ...prev, date: shiftAnchor(view, anchor, step) }) })
  const setView = (next: CalendarView) => void navigate({ search: (prev) => ({ ...prev, view: next }) })

  return (
    <section className="calendar">
      <header className="cal-header">
        <h2 className="cal-title-text">{title}</h2>
        <div className="cal-controls">
          <button type="button" className="cal-nav" aria-label={t('calendar.previous')} onClick={() => go(-1)}>
            ‹
          </button>
          <button type="button" className="cal-nav" aria-label={t('calendar.next')} onClick={() => go(1)}>
            ›
          </button>
          <button
            type="button"
            className="cal-today"
            onClick={() => void navigate({ search: (prev) => ({ ...prev, date: undefined }) })}
          >
            {t('calendar.today')}
          </button>
          <div className="cal-seg" role="group" aria-label={t('calendar.view')}>
            {VIEWS.map((option) => (
              <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}>
                {t(`calendar.${option}`)}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="cal-weekdays" aria-hidden="true">
        {days.slice(0, 7).map((day) => (
          <span key={day.key}>{weekday.format(dateOf(day.key))}</span>
        ))}
      </div>
      <div className="cal-grid" key={`${view}-${days[0].key}`}>
        {days.map((day) => (
          <DayCell
            key={day.key}
            day={day}
            notes={byDay.get(day.key) ?? []}
            area={area}
            height={height}
            today={day.key === today}
            showTime={view === 'week' || day.key === today}
            now={now}
            locale={locale}
          />
        ))}
      </div>
    </section>
  )
}
