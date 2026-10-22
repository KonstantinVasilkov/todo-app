export const DAY_START = 7 * 60
export const DAY_END = 23 * 60
export const NOW_HEIGHT = 4

export interface CellArea {
  top: number
  bottom: number
  rowHeight: number
  gap: number
}

export interface CellItem {
  id: string
  minutes: number
}

export interface CellLayout {
  rows: { id: string; top: number }[]
  more: { top: number; count: number } | null
  now: { top: number } | null
}

interface Entry {
  id: string | null
  minutes: number
  height: number
}

function topFor(minutes: number, height: number, area: Pick<CellArea, 'top' | 'bottom'>): number {
  const share = Math.min(1, Math.max(0, (minutes - DAY_START) / (DAY_END - DAY_START)))
  return Math.round(area.top + share * (area.bottom - area.top - height))
}

export function positionOf(minutes: number, area: Pick<CellArea, 'top' | 'bottom' | 'rowHeight'>): number {
  return topFor(minutes, area.rowHeight, area)
}

function entriesOf(rows: CellItem[], area: CellArea, nowMinutes: number | undefined): Entry[] {
  const entries: Entry[] = rows.map((row) => ({ id: row.id, minutes: row.minutes, height: area.rowHeight }))
  if (nowMinutes === undefined) return entries
  const index = entries.findIndex((entry) => entry.minutes > nowMinutes)
  entries.splice(index === -1 ? entries.length : index, 0, { id: null, minutes: nowMinutes, height: NOW_HEIGHT })
  return entries
}

function fits(entries: Entry[], area: CellArea): boolean {
  const total = entries.reduce((sum, entry) => sum + entry.height, 0) + area.gap * Math.max(0, entries.length - 1)
  return total <= area.bottom - area.top
}

function place(entries: Entry[], area: CellArea): number[] {
  const tops = entries.map((entry) => topFor(entry.minutes, entry.height, area))
  for (let i = 1; i < tops.length; i++) tops[i] = Math.max(tops[i], tops[i - 1] + entries[i - 1].height + area.gap)
  for (let i = tops.length - 1; i >= 0; i--) {
    const limit = i === tops.length - 1 ? area.bottom - entries[i].height : tops[i + 1] - area.gap - entries[i].height
    tops[i] = Math.min(tops[i], limit)
  }
  return tops
}

function finish(entries: Entry[], area: CellArea, more: CellLayout['more']): CellLayout {
  const tops = place(entries, area)
  const rows: CellLayout['rows'] = []
  let now: CellLayout['now'] = null
  entries.forEach((entry, i) => {
    if (entry.id === null) now = { top: tops[i] }
    else rows.push({ id: entry.id, top: tops[i] })
  })
  return { rows, more, now }
}

export function layoutCell(items: CellItem[], area: CellArea, nowMinutes?: number): CellLayout {
  const sorted = [...items].sort((a, b) => a.minutes - b.minutes)
  const all = entriesOf(sorted, area, nowMinutes)
  if (fits(all, area)) return finish(all, area, null)
  const reduced = { ...area, bottom: area.bottom - area.rowHeight - area.gap }
  for (let visible = sorted.length - 1; visible > 0; visible--) {
    const entries = entriesOf(sorted.slice(0, visible), area, nowMinutes)
    if (fits(entries, reduced)) {
      return finish(entries, reduced, { top: area.bottom - area.rowHeight, count: sorted.length - visible })
    }
  }
  return finish(entriesOf([], area, nowMinutes), reduced, { top: area.bottom - area.rowHeight, count: sorted.length })
}
