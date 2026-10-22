import { describe, expect, it } from 'vitest'
import { parseNotesSearch, toListParams } from './filters'

const now = new Date('2026-10-21T09:00:00Z')

describe('parseNotesSearch', () => {
  it('keeps valid values from the URL', () => {
    expect(
      parseNotesSearch({ status: ['todo', 'none'], category: ['c1'], due: 'today', from: '2026-10-01', to: '2026-10-31' }),
    ).toEqual({ status: ['todo', 'none'], category: ['c1'], due: 'today', from: '2026-10-01', to: '2026-10-31' })
  })

  it('accepts a single value where a list is expected', () => {
    expect(parseNotesSearch({ status: 'done', category: 'c2' })).toEqual({ status: ['done'], category: ['c2'] })
  })

  it('drops values a hand-edited URL could carry', () => {
    expect(
      parseNotesSearch({ status: ['todo', 'urgent', 5], category: [42], due: 'someday', from: '21.10.2026', page: 3 }),
    ).toEqual({ status: ['todo'] })
  })
})

describe('toListParams', () => {
  it('asks for everything when nothing is selected', () => {
    expect(toListParams({}, now)).toEqual({})
  })

  it('passes statuses and categories through', () => {
    expect(toListParams({ status: ['todo', 'none'], category: ['c1', 'c2'] }, now)).toEqual({
      status: ['todo', 'none'],
      category_id: ['c1', 'c2'],
    })
  })

  it('limits "today" to the local day', () => {
    expect(toListParams({ due: 'today' }, now)).toEqual({
      due_from: '2026-10-20T21:00:00.000Z',
      due_to: '2026-10-21T20:59:59.999Z',
    })
  })

  it('treats "overdue" as open tasks due before now', () => {
    expect(toListParams({ due: 'overdue' }, now)).toEqual({
      status: ['todo', 'in_progress'],
      due_to: '2026-10-21T09:00:00.000Z',
    })
  })

  it('lets an explicit status narrow "overdue"', () => {
    expect(toListParams({ due: 'overdue', status: ['in_progress'] }, now)).toEqual({
      status: ['in_progress'],
      due_to: '2026-10-21T09:00:00.000Z',
    })
  })

  it('asks for notes without a due date', () => {
    expect(toListParams({ due: 'none', from: '2026-10-01' }, now)).toEqual({ has_due: false })
  })

  it('turns a local date range into inclusive UTC bounds', () => {
    expect(toListParams({ from: '2026-10-01', to: '2026-10-31' }, now)).toEqual({
      due_from: '2026-09-30T21:00:00.000Z',
      due_to: '2026-10-31T20:59:59.999Z',
    })
    expect(toListParams({ to: '2026-10-31' }, now)).toEqual({ due_to: '2026-10-31T20:59:59.999Z' })
  })
})
