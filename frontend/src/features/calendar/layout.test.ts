import { describe, expect, it } from 'vitest'
import { MONTH_AREA } from './geometry'
import { layoutCell, NOW_HEIGHT, positionOf } from './layout'

const area = { top: 20, bottom: 116, rowHeight: 16, gap: 2 }
const at = (hours: number, minutes = 0) => hours * 60 + minutes

describe('positionOf', () => {
  it('maps 07:00 to the top and 23:00 to the bottom row', () => {
    expect(positionOf(at(7), area)).toBe(20)
    expect(positionOf(at(23), area)).toBe(100)
    expect(positionOf(at(15), area)).toBe(60)
  })

  it('clamps times outside the day scale', () => {
    expect(positionOf(at(5, 30), area)).toBe(20)
    expect(positionOf(at(23, 59), area)).toBe(100)
  })
})

describe('layoutCell', () => {
  it('places rows by time, earliest first', () => {
    const { rows, more } = layoutCell(
      [
        { id: 'late', minutes: at(19) },
        { id: 'early', minutes: at(9) },
      ],
      area,
    )

    expect(rows).toEqual([
      { id: 'early', top: 30 },
      { id: 'late', top: 80 },
    ])
    expect(more).toBeNull()
  })

  it('pushes close rows down so they never overlap', () => {
    const { rows } = layoutCell(
      [
        { id: 'a', minutes: at(12) },
        { id: 'b', minutes: at(12) },
        { id: 'c', minutes: at(12, 5) },
      ],
      area,
    )

    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(rows.map((r) => r.top)).toEqual([45, 63, 81])
  })

  it('stacks late rows upwards from the bottom instead of running out of the cell', () => {
    const { rows, more } = layoutCell(
      [
        { id: 'a', minutes: at(23, 59) },
        { id: 'b', minutes: at(23, 59) },
        { id: 'c', minutes: at(23, 59) },
      ],
      area,
    )

    expect(rows.map((r) => r.top)).toEqual([64, 82, 100])
    expect(more).toBeNull()
  })

  it('fills the cell exactly when the rows just fit', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, minutes: at(12) }))

    const { rows, more } = layoutCell(items, area)

    expect(rows.map((r) => r.top)).toEqual([28, 46, 64, 82, 100])
    expect(more).toBeNull()
  })

  it('turns the last visible row into "+N more" when rows do not fit', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => ({ id, minutes: at(8 + i) }))

    const { rows, more } = layoutCell(items, area)

    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(Math.max(...rows.map((r) => r.top)) + area.rowHeight + area.gap).toBeLessThanOrEqual(100)
    expect(more).toEqual({ top: 100, count: 3 })
  })

  it('is empty for a day without rows', () => {
    expect(layoutCell([], area)).toEqual({ rows: [], more: null, now: null })
  })

  describe('with the current time', () => {
    const clear = (rows: { id: string; top: number }[], line: number, rowHeight: number) =>
      rows.every((row) => row.top + rowHeight <= line || row.top >= line + NOW_HEIGHT)

    it('keeps the now line between past and future rows without crossing any', () => {
      const day = [
        { id: 'standup', minutes: at(9, 30) },
        { id: 'lunch', minutes: at(12, 30) },
        { id: 'review', minutes: at(17) },
        { id: 'groceries', minutes: at(19) },
      ]

      const { rows, now } = layoutCell(day, MONTH_AREA, at(14, 20))
      const top = (id: string) => rows.find((row) => row.id === id)!.top

      expect(now).not.toBeNull()
      expect(top('lunch') + MONTH_AREA.rowHeight + MONTH_AREA.gap).toBeLessThanOrEqual(now!.top)
      expect(now!.top + NOW_HEIGHT + MONTH_AREA.gap).toBeLessThanOrEqual(top('review'))
      expect(clear(rows, now!.top, MONTH_AREA.rowHeight)).toBe(true)
    })

    it('counts a row due exactly now as past', () => {
      const { rows, now } = layoutCell([{ id: 'a', minutes: at(14, 20) }], MONTH_AREA, at(14, 20))

      expect(rows[0].top + MONTH_AREA.rowHeight).toBeLessThanOrEqual(now!.top)
    })

    it('puts the line above every row in the morning and below every row at night', () => {
      const day = [
        { id: 'a', minutes: at(9) },
        { id: 'b', minutes: at(10) },
      ]

      const morning = layoutCell(day, MONTH_AREA, at(6))
      const night = layoutCell(day, MONTH_AREA, at(23, 30))

      expect(morning.now!.top + NOW_HEIGHT).toBeLessThanOrEqual(Math.min(...morning.rows.map((r) => r.top)))
      expect(Math.max(...night.rows.map((r) => r.top)) + MONTH_AREA.rowHeight).toBeLessThanOrEqual(night.now!.top)
    })

    it('keeps rows clear of the line when the day overflows', () => {
      const day = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => ({ id, minutes: at(8 + i * 2) }))

      const { rows, more, now } = layoutCell(day, MONTH_AREA, at(13))

      expect(more).not.toBeNull()
      expect(now!.top + NOW_HEIGHT).toBeLessThanOrEqual(more!.top)
      expect(clear(rows, now!.top, MONTH_AREA.rowHeight)).toBe(true)
    })
  })
})
