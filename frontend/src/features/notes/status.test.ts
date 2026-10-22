import { describe, expect, it } from 'vitest'
import { note } from '../../test/fixtures'
import { isOverdue } from './status'

const now = new Date('2026-10-21T09:00:00Z')

describe('isOverdue', () => {
  it('flags open tasks whose due has passed', () => {
    expect(isOverdue(note({ status: 'todo', due: '2026-10-21T08:59:00Z' }), now)).toBe(true)
    expect(isOverdue(note({ status: 'in_progress', due: '2026-10-20T08:00:00Z' }), now)).toBe(true)
  })

  it('does not flag tasks due later, finished tasks, plain notes or notes without due', () => {
    expect(isOverdue(note({ status: 'todo', due: '2026-10-21T09:01:00Z' }), now)).toBe(false)
    expect(isOverdue(note({ status: 'done', due: '2026-10-20T08:00:00Z' }), now)).toBe(false)
    expect(isOverdue(note({ status: null, due: '2026-10-20T08:00:00Z' }), now)).toBe(false)
    expect(isOverdue(note({ status: 'todo', due: null }), now)).toBe(false)
  })
})
