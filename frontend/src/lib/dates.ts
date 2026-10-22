const pad = (n: number) => String(n).padStart(2, '0')

function parseDay(day: string): [number, number, number] {
  const [year, month, date] = day.split('-').map(Number)
  return [year, month - 1, date]
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isEndOfDay(date: Date): boolean {
  return date.getHours() === 23 && date.getMinutes() === 59 && date.getSeconds() === 59
}

export function localDayRange(day: string): { from: string; to: string } {
  const [year, month, date] = parseDay(day)
  return {
    from: new Date(year, month, date, 0, 0, 0, 0).toISOString(),
    to: new Date(year, month, date, 23, 59, 59, 999).toISOString(),
  }
}

export function todayKey(now: Date): string {
  return dayKey(now)
}

export function dateKey(date: Date): string {
  return dayKey(date)
}

export function dateOf(key: string): Date {
  return new Date(...parseDay(key))
}

export function addDays(key: string, days: number): string {
  const [year, month, date] = parseDay(key)
  return dayKey(new Date(year, month, date + days))
}

export function dayKeyOf(iso: string): string {
  return dayKey(new Date(iso))
}

export function minutesOfDay(iso: string): number {
  const date = new Date(iso)
  return date.getHours() * 60 + date.getMinutes()
}

export function dueToISO(date: string, time: string): string | null {
  if (!date) return null
  const [year, month, day] = parseDay(date)
  if (!time) return new Date(year, month, day, 23, 59, 59).toISOString()
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(year, month, day, hours, minutes).toISOString()
}

export function dueFromISO(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const due = new Date(iso)
  return { date: dayKey(due), time: isEndOfDay(due) ? '' : `${pad(due.getHours())}:${pad(due.getMinutes())}` }
}

export function formatTime(value: Date | string, locale: string): string {
  const twelveHour = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12
  return new Intl.DateTimeFormat(locale, { hour: twelveHour ? 'numeric' : '2-digit', minute: '2-digit' }).format(
    new Date(value),
  )
}

export function formatDue(iso: string, now: Date, locale: string): string {
  const { date, time } = dueFromISO(iso)
  const days = Math.round((Date.UTC(...parseDay(date)) - Date.UTC(...parseDay(dayKey(now)))) / 86_400_000)
  const label =
    Math.abs(days) <= 1
      ? new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day')
      : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(iso))
  if (!time) return label
  return `${label}, ${formatTime(iso, locale)}`
}
