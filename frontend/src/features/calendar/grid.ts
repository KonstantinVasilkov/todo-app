import { addDays, dateKey, dateOf, localDayRange } from '../../lib/dates'

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type CalendarView = 'month' | 'week'

export interface CalendarDay {
  key: string
  inMonth: boolean
  weekend: boolean
}

interface WeekInfo {
  firstDay: number
}

type LocaleWithWeekInfo = Intl.Locale & { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo }

function weekInfoFirstDay(locale: string): number | undefined {
  try {
    const intlLocale = new Intl.Locale(locale) as LocaleWithWeekInfo
    return (intlLocale.getWeekInfo?.() ?? intlLocale.weekInfo)?.firstDay
  } catch {
    return undefined
  }
}

export function firstDayOfWeek(locale: string): Weekday {
  const firstDay = weekInfoFirstDay(locale)
  if (firstDay !== undefined) return (firstDay % 7) as Weekday
  return locale.startsWith('ru') ? 1 : 0
}

const weekdayOf = (key: string) => dateOf(key).getDay()

function daysBetween(start: string, end: string, inMonth: (key: string) => boolean): CalendarDay[] {
  const days: CalendarDay[] = []
  for (let key = start; key <= end; key = addDays(key, 1)) {
    const weekday = weekdayOf(key)
    days.push({ key, inMonth: inMonth(key), weekend: weekday === 0 || weekday === 6 })
  }
  return days
}

function startOfWeek(key: string, firstDay: Weekday): string {
  return addDays(key, -((weekdayOf(key) - firstDay + 7) % 7))
}

export function monthDays(anchor: string, firstDay: Weekday): CalendarDay[] {
  const anchorDate = dateOf(anchor)
  const first = dateKey(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1))
  const last = dateKey(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0))
  const start = startOfWeek(first, firstDay)
  const end = addDays(startOfWeek(last, firstDay), 6)
  const month = first.slice(0, 7)
  return daysBetween(start, end, (key) => key.startsWith(month))
}

export function weekDays(anchor: string, firstDay: Weekday): CalendarDay[] {
  const start = startOfWeek(anchor, firstDay)
  return daysBetween(start, addDays(start, 6), () => true)
}

export function shiftAnchor(view: CalendarView, anchor: string, step: 1 | -1): string {
  if (view === 'week') return addDays(anchor, 7 * step)
  const date = dateOf(anchor)
  return dateKey(new Date(date.getFullYear(), date.getMonth() + step, 1))
}

export function dayRange(days: CalendarDay[]): { from: string; to: string } {
  return { from: localDayRange(days[0].key).from, to: localDayRange(days[days.length - 1].key).to }
}
