import type { NoteRead } from '../../api/types'

export const CATEGORY_PALETTE = [
  '#60a5fa',
  '#f59e0b',
  '#34d399',
  '#c084fc',
  '#f472b6',
  '#22d3ee',
  '#fb923c',
  '#a3e635',
  '#818cf8',
] as const

function hash(text: string): number {
  let value = 0x811c9dc5
  for (const char of text) {
    value ^= char.codePointAt(0) ?? 0
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

export function categoryColor(id: string): string {
  return CATEGORY_PALETTE[hash(id) % CATEGORY_PALETTE.length]
}

export function noteColor(note: Pick<NoteRead, 'categories'>): string | null {
  const [first] = [...note.categories].sort((a, b) => a.name.localeCompare(b.name))
  return first ? categoryColor(first.id) : null
}
