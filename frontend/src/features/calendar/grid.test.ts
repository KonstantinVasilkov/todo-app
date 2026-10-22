import { describe, expect, it } from 'vitest'
import { dayRange, firstDayOfWeek, monthDays, shiftAnchor, weekDays } from './grid'

describe('firstDayOfWeek', () => {
  it('follows the locale', () => {
    expect(firstDayOfWeek('en')).toBe(0)
    expect(firstDayOfWeek('ru')).toBe(1)
  })
})

describe('monthDays', () => {
  it('pads a month to whole weeks starting on Monday', () => {
    const days = monthDays('2026-10-15', 1)

    expect(days).toHaveLength(35)
    expect(days[0]).toEqual({ key: '2026-09-28', inMonth: false, weekend: false })
    expect(days[3]).toEqual({ key: '2026-10-01', inMonth: true, weekend: false })
    expect(days.at(-1)).toEqual({ key: '2026-11-01', inMonth: false, weekend: true })
  })

  it('pads a month to whole weeks starting on Sunday', () => {
    const days = monthDays('2026-10-15', 0)

    expect(days[0].key).toBe('2026-09-27')
    expect(days.at(-1)!.key).toBe('2026-10-31')
    expect(days).toHaveLength(35)
  })

  it('uses six weeks when the month needs them', () => {
    const days = monthDays('2026-08-10', 1)

    expect(days[0].key).toBe('2026-07-27')
    expect(days.at(-1)!.key).toBe('2026-09-06')
    expect(days).toHaveLength(42)
  })

  it('marks Saturdays and Sundays as weekend', () => {
    const byKey = Object.fromEntries(monthDays('2026-10-15', 1).map((d) => [d.key, d.weekend]))

    expect(byKey['2026-10-03']).toBe(true)
    expect(byKey['2026-10-04']).toBe(true)
    expect(byKey['2026-10-05']).toBe(false)
  })
})

describe('weekDays', () => {
  it('returns the week that contains the anchor', () => {
    expect(weekDays('2026-10-21', 1).map((d) => d.key)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(weekDays('2026-10-21', 0)[0].key).toBe('2026-10-18')
    expect(weekDays('2026-10-21', 1).every((d) => d.inMonth)).toBe(true)
  })
})

describe('shiftAnchor', () => {
  it('moves by whole months to the first day', () => {
    expect(shiftAnchor('month', '2026-10-21', 1)).toBe('2026-11-01')
    expect(shiftAnchor('month', '2026-10-21', -1)).toBe('2026-09-01')
    expect(shiftAnchor('month', '2026-01-15', -1)).toBe('2025-12-01')
  })

  it('moves by weeks', () => {
    expect(shiftAnchor('week', '2026-10-21', 1)).toBe('2026-10-28')
    expect(shiftAnchor('week', '2026-11-02', -1)).toBe('2026-10-26')
  })
})

describe('dayRange', () => {
  it('covers the visible days in local time, expressed in UTC', () => {
    expect(dayRange(monthDays('2026-10-15', 0))).toEqual({
      from: '2026-09-26T21:00:00.000Z',
      to: '2026-10-31T20:59:59.999Z',
    })
  })
})
