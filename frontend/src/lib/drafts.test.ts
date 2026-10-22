import { describe, expect, it } from 'vitest'
import { clearDraft, loadDraft, saveDraft } from './drafts'

describe('drafts', () => {
  it('returns what was saved for the same version of the record', () => {
    saveDraft('note:n1', '2026-10-21T10:00:00Z', { title: 'Draft' })

    expect(loadDraft('note:n1', '2026-10-21T10:00:00Z')).toEqual({ title: 'Draft' })
  })

  it('drops a draft once the record changed underneath it', () => {
    saveDraft('note:n1', '2026-10-21T10:00:00Z', { title: 'Draft' })

    expect(loadDraft('note:n1', '2026-10-21T11:00:00Z')).toBeNull()
  })

  it('keeps drafts of different records apart', () => {
    saveDraft('note:new', null, { title: 'New one' })

    expect(loadDraft('note:n1', null)).toBeNull()
    expect(loadDraft('note:new', null)).toEqual({ title: 'New one' })
  })

  it('forgets a cleared draft', () => {
    saveDraft('note:new', null, { title: 'New one' })

    clearDraft('note:new')

    expect(loadDraft('note:new', null)).toBeNull()
  })

  it('ignores a corrupted entry', () => {
    localStorage.setItem('todo.draft.note:new', '{not json')

    expect(loadDraft('note:new', null)).toBeNull()
  })
})
