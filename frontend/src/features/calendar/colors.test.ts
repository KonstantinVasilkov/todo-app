import { describe, expect, it } from 'vitest'
import { category } from '../../test/fixtures'
import { CATEGORY_PALETTE, categoryColor, noteColor } from './colors'

describe('categoryColor', () => {
  it('gives the same category the same palette color every time', () => {
    const id = '3f2b1c4d-0000-4000-8000-000000000001'

    expect(categoryColor(id)).toBe(categoryColor(id))
    expect(CATEGORY_PALETTE).toContain(categoryColor(id))
  })

  it('spreads different categories over the palette', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)

    expect(new Set(ids.map(categoryColor)).size).toBeGreaterThanOrEqual(6)
  })
})

describe('noteColor', () => {
  it('uses the first category by name', () => {
    const work = category({ id: 'c-work', name: 'Work' })
    const home = category({ id: 'c-home', name: 'home' })

    expect(noteColor({ categories: [work, home] })).toBe(categoryColor('c-home'))
  })

  it('is neutral without categories', () => {
    expect(noteColor({ categories: [] })).toBeNull()
  })
})
