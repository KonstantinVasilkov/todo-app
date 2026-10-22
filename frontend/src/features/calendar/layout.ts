export const DAY_START = 7 * 60
export const DAY_END = 23 * 60

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
}

export function positionOf(minutes: number, area: Pick<CellArea, 'top' | 'bottom' | 'rowHeight'>): number {
  const share = Math.min(1, Math.max(0, (minutes - DAY_START) / (DAY_END - DAY_START)))
  return Math.round(area.top + share * (area.bottom - area.top - area.rowHeight))
}

function place(items: CellItem[], area: CellArea): CellLayout['rows'] {
  const step = area.rowHeight + area.gap
  const rows = items.map((item) => ({ id: item.id, top: positionOf(item.minutes, area) }))
  for (let i = 1; i < rows.length; i++) rows[i].top = Math.max(rows[i].top, rows[i - 1].top + step)
  for (let i = rows.length - 1; i >= 0; i--) {
    const limit = i === rows.length - 1 ? area.bottom - area.rowHeight : rows[i + 1].top - step
    rows[i].top = Math.min(rows[i].top, limit)
  }
  return rows
}

export function layoutCell(items: CellItem[], area: CellArea): CellLayout {
  const sorted = [...items].sort((a, b) => a.minutes - b.minutes)
  const step = area.rowHeight + area.gap
  const capacity = Math.floor((area.bottom - area.top + area.gap) / step)
  if (sorted.length <= capacity) return { rows: place(sorted, area), more: null }
  const visible = sorted.slice(0, Math.max(0, capacity - 1))
  return {
    rows: place(visible, { ...area, bottom: area.bottom - step }),
    more: { top: area.bottom - area.rowHeight, count: sorted.length - visible.length },
  }
}
