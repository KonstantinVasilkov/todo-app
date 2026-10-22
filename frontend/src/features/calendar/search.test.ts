import { describe, expect, it } from 'vitest'
import { parseHomeSearch, parseNewNoteSearch } from './search'

describe('parseHomeSearch', () => {
  it('keeps a valid view and anchor date', () => {
    expect(parseHomeSearch({ view: 'week', date: '2026-10-21' })).toEqual({ view: 'week', date: '2026-10-21' })
  })

  it('drops values a hand-edited URL could carry', () => {
    expect(parseHomeSearch({ view: 'year', date: '21.10.2026' })).toEqual({})
    expect(parseHomeSearch({ date: '2026-13-45' })).toEqual({})
  })
})

describe('parseNewNoteSearch', () => {
  it('keeps a valid day to prefill', () => {
    expect(parseNewNoteSearch({ date: '2026-10-21' })).toEqual({ date: '2026-10-21' })
    expect(parseNewNoteSearch({ date: 'tomorrow' })).toEqual({})
  })
})
