import { describe, expect, it } from 'vitest'
import { category, note } from '../../test/fixtures'
import { emptyNoteForm, formFromNote, toNoteCreate, toNoteUpdate, type NoteFormValues } from './formValues'

const saved = note({
  title: 'Call mom',
  body: 'about the weekend',
  due: '2026-10-21T11:30:00+00:00',
  status: 'in_progress',
  categories: [category({ id: 'c1' }), category({ id: 'c2', name: 'Family' })],
})

describe('formFromNote', () => {
  it('fills the form with local values', () => {
    expect(formFromNote(saved)).toEqual({
      title: 'Call mom',
      body: 'about the weekend',
      dueDate: '2026-10-21',
      dueTime: '14:30',
      status: 'in_progress',
      categoryIds: ['c1', 'c2'],
    })
  })

  it('shows an absent body, due and status as empty choices', () => {
    const form = formFromNote(note({ body: null, due: null, status: null }))

    expect(form).toMatchObject({ body: '', dueDate: '', dueTime: '', status: 'none' })
  })
})

describe('toNoteCreate', () => {
  it('sends only what the user filled in', () => {
    expect(toNoteCreate({ ...emptyNoteForm, title: '  Buy bread ' })).toEqual({
      title: 'Buy bread',
      status: 'todo',
      category_ids: [],
    })
  })

  it('sends a plain note as an explicit null status', () => {
    expect(toNoteCreate({ ...emptyNoteForm, title: 'Idea', status: 'none' }).status).toBeNull()
  })

  it('sends body, due and categories when set', () => {
    const values: NoteFormValues = {
      title: 'Report',
      body: 'draft\n',
      dueDate: '2026-10-21',
      dueTime: '',
      status: 'todo',
      categoryIds: ['c1'],
    }

    expect(toNoteCreate(values)).toEqual({
      title: 'Report',
      body: 'draft\n',
      due: '2026-10-21T20:59:59.000Z',
      status: 'todo',
      category_ids: ['c1'],
    })
  })

  it('treats a whitespace-only body as no body', () => {
    expect(toNoteCreate({ ...emptyNoteForm, title: 'x', body: '  \n' })).not.toHaveProperty('body')
  })
})

describe('toNoteUpdate', () => {
  it('sends nothing when nothing changed', () => {
    expect(toNoteUpdate(saved, formFromNote(saved))).toEqual({})
  })

  it('sends only the changed field', () => {
    expect(toNoteUpdate(saved, { ...formFromNote(saved), title: 'Call dad' })).toEqual({ title: 'Call dad' })
  })

  it('clears body, due and status with explicit nulls', () => {
    const values = { ...formFromNote(saved), body: '', dueDate: '', dueTime: '', status: 'none' as const }

    expect(toNoteUpdate(saved, values)).toEqual({ body: null, due: null, status: null })
  })

  it('ignores a due that is the same instant written differently', () => {
    const sameDue = note({ ...saved, due: '2026-10-21T11:30:00.000Z' })

    expect(toNoteUpdate(sameDue, formFromNote(saved))).toEqual({})
  })

  it('sends the full category set only when the set changed', () => {
    expect(toNoteUpdate(saved, { ...formFromNote(saved), categoryIds: ['c2', 'c1'] })).toEqual({})
    expect(toNoteUpdate(saved, { ...formFromNote(saved), categoryIds: ['c2'] })).toEqual({ category_ids: ['c2'] })
  })
})
