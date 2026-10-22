import { describe, expect, it } from 'vitest'
import { dueFromISO, dueToISO, formatDue, localDayRange, todayKey } from './dates'

describe('localDayRange', () => {
  it('covers the whole local day, expressed in UTC', () => {
    expect(localDayRange('2026-10-21')).toEqual({
      from: '2026-10-20T21:00:00.000Z',
      to: '2026-10-21T20:59:59.999Z',
    })
  })
})

describe('todayKey', () => {
  it('uses the local calendar date, not the UTC one', () => {
    expect(todayKey(new Date('2026-10-21T22:30:00Z'))).toBe('2026-10-22')
  })
})

describe('dueToISO', () => {
  it('is null without a date', () => {
    expect(dueToISO('', '')).toBeNull()
    expect(dueToISO('', '14:30')).toBeNull()
  })

  it('converts a local date and time to UTC', () => {
    expect(dueToISO('2026-10-21', '14:30')).toBe('2026-10-21T11:30:00.000Z')
  })

  it('treats a date without time as the end of that local day', () => {
    expect(dueToISO('2026-10-21', '')).toBe('2026-10-21T20:59:59.000Z')
  })
})

describe('dueFromISO', () => {
  it('is empty for no due date', () => {
    expect(dueFromISO(null)).toEqual({ date: '', time: '' })
  })

  it('splits a UTC instant into local date and time', () => {
    expect(dueFromISO('2026-10-21T11:30:00+00:00')).toEqual({ date: '2026-10-21', time: '14:30' })
  })

  it('reads the end of a local day back as a date without time', () => {
    expect(dueFromISO('2026-10-21T20:59:59Z')).toEqual({ date: '2026-10-21', time: '' })
  })
})

describe('formatDue', () => {
  const now = new Date('2026-10-21T09:00:00Z')

  it('names nearby days in words', () => {
    expect(formatDue('2026-10-21T20:59:59Z', now, 'en')).toBe('today')
    expect(formatDue('2026-10-22T11:30:00Z', now, 'en')).toBe('tomorrow, 02:30 PM')
    expect(formatDue('2026-10-20T20:59:59Z', now, 'en')).toBe('yesterday')
  })

  it('shows other dates with a day and month, time only when set', () => {
    expect(formatDue('2026-11-05T20:59:59Z', now, 'en')).toBe('Nov 5')
    expect(formatDue('2026-11-05T06:15:00Z', now, 'en')).toBe('Nov 5, 09:15 AM')
  })

  it('formats in the given language', () => {
    const english = formatDue('2026-10-22T11:30:00Z', now, 'en')
    const russian = formatDue('2026-10-22T11:30:00Z', now, 'ru')

    expect(russian).not.toBe(english)
    expect(russian).toMatch(/, 14:30$/)
  })
})
