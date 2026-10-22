import { cleanup, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import en from '../../i18n/locales/en.json'
import { category, note, user as me } from '../../test/fixtures'
import { renderApp, stubNotes, stubShell } from '../../test/renderApp'
import { api, server } from '../../test/server'

const home = category({ id: 'c1', name: 'Home' })
const work = category({ id: 'c2', name: 'Work' })

describe('new note', () => {
  it('creates a note with a due date and the chosen categories', async () => {
    stubShell([home, work])
    stubNotes()
    let created: unknown = null
    server.use(
      http.post(api('/notes'), async ({ request }) => {
        created = await request.json()
        return HttpResponse.json(note(), { status: 201 })
      }),
    )
    const { user } = renderApp('/notes/new')

    await user.type(await screen.findByLabelText(en.editor.fields.title), 'Submit report')
    await user.type(screen.getByLabelText(en.editor.fields.body), 'quarterly')
    await user.type(screen.getByLabelText(en.editor.fields.dueDate), '2026-10-25')
    await user.click(await screen.findByRole('checkbox', { name: 'Work' }))
    await user.click(screen.getByRole('button', { name: en.editor.create }))

    expect(await screen.findByRole('heading', { name: en.notes.title.all })).toBeInTheDocument()
    expect(created).toEqual({
      title: 'Submit report',
      body: 'quarterly',
      due: '2026-10-25T20:59:59.000Z',
      status: 'todo',
      category_ids: ['c2'],
    })
  })

  it('shows the server validation error next to the field', async () => {
    stubShell()
    server.use(
      http.post(api('/notes'), () =>
        HttpResponse.json(
          { detail: [{ loc: ['body', 'title'], msg: 'String should have at most 200 characters', type: 'string_too_long' }] },
          { status: 422 },
        ),
      ),
    )
    const { user } = renderApp('/notes/new')

    await user.type(await screen.findByLabelText(en.editor.fields.title), 'very long')
    await user.click(screen.getByRole('button', { name: en.editor.create }))

    await waitFor(() => expect(screen.getByLabelText(en.editor.fields.title)).toHaveAccessibleDescription(en.errors.validation.string_too_long))
  })

  it('recovers when a chosen category was deleted elsewhere', async () => {
    let categories = [home, work]
    const created: unknown[] = []
    server.use(
      http.get(api('/users/me'), () => HttpResponse.json(me)),
      http.get(api('/categories'), () => HttpResponse.json(categories)),
      http.post(api('/notes'), async ({ request }) => {
        const body = (await request.json()) as { category_ids: string[] }
        if (body.category_ids.includes('c2')) {
          return HttpResponse.json(
            { detail: [{ loc: ['body', 'category_ids'], msg: 'Unknown category', type: 'invalid_reference' }] },
            { status: 422 },
          )
        }
        created.push(body)
        return HttpResponse.json(note(), { status: 201 })
      }),
    )
    stubNotes()
    const { user } = renderApp('/notes/new')

    await user.type(await screen.findByLabelText(en.editor.fields.title), 'Submit report')
    await user.click(await screen.findByRole('checkbox', { name: 'Work' }))
    categories = [home]
    await user.click(screen.getByRole('button', { name: en.editor.create }))

    await waitFor(() =>
      expect(screen.getByRole('group', { name: en.editor.fields.categories })).toHaveAccessibleDescription(
        en.errors.invalid_reference.category_ids,
      ),
    )
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Work' })).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: en.editor.create }))

    expect(await screen.findByRole('heading', { name: en.notes.title.all })).toBeInTheDocument()
    expect(created).toEqual([{ title: 'Submit report', status: 'todo', category_ids: [] }])
  })

  it('brings back an unsaved draft after leaving the page', async () => {
    stubShell()
    const first = renderApp('/notes/new')
    await first.user.type(await screen.findByLabelText(en.editor.fields.title), 'Unfinished')
    cleanup()

    const { user } = renderApp('/notes/new')

    expect(await screen.findByLabelText(en.editor.fields.title)).toHaveValue('Unfinished')
    await user.click(screen.getByRole('button', { name: en.editor.discardDraft }))
    expect(screen.getByLabelText(en.editor.fields.title)).toHaveValue('')
  })
})

describe('existing note', () => {
  const saved = note({
    id: 'n1',
    title: 'Call mom',
    body: 'about the weekend',
    due: '2026-10-21T11:30:00Z',
    status: 'in_progress',
    categories: [home],
  })

  it('opens the note and saves only what changed', async () => {
    stubShell([home, work])
    stubNotes()
    let patch: unknown = null
    server.use(
      http.get(api('/notes/{note_id}'), () => HttpResponse.json(saved)),
      http.patch(api('/notes/{note_id}'), async ({ request }) => {
        patch = await request.json()
        return HttpResponse.json({ ...saved, title: 'Call dad' })
      }),
    )
    const { user } = renderApp('/notes/n1')

    const title = await screen.findByLabelText(en.editor.fields.title)
    expect(title).toHaveValue('Call mom')
    expect(screen.getByLabelText(en.editor.fields.dueTime)).toHaveValue('14:30')
    expect(screen.getByLabelText(en.editor.fields.status)).toHaveValue('in_progress')
    expect(await screen.findByRole('checkbox', { name: 'Home' })).toBeChecked()

    await user.clear(title)
    await user.type(title, 'Call dad')
    await user.click(screen.getByRole('button', { name: en.common.save }))

    expect(await screen.findByRole('heading', { name: en.notes.title.all })).toBeInTheDocument()
    expect(patch).toEqual({ title: 'Call dad' })
  })

  it('turns a task into a plain note with an explicit null status', async () => {
    stubShell([home])
    stubNotes()
    let patch: unknown = null
    server.use(
      http.get(api('/notes/{note_id}'), () => HttpResponse.json(saved)),
      http.patch(api('/notes/{note_id}'), async ({ request }) => {
        patch = await request.json()
        return HttpResponse.json({ ...saved, status: null })
      }),
    )
    const { user } = renderApp('/notes/n1')

    await user.selectOptions(await screen.findByLabelText(en.editor.fields.status), en.status.none)
    await user.click(screen.getByRole('button', { name: en.common.save }))

    await waitFor(() => expect(patch).toEqual({ status: null }))
  })

  it('deletes only after a second confirmation', async () => {
    stubShell()
    stubNotes()
    let deleted = false
    server.use(
      http.get(api('/notes/{note_id}'), () => HttpResponse.json(saved)),
      http.delete(api('/notes/{note_id}'), () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp('/notes/n1')

    await user.click(await screen.findByRole('button', { name: en.common.delete }))
    expect(deleted).toBe(false)
    await user.click(screen.getByRole('button', { name: en.common.confirmDelete }))

    expect(await screen.findByRole('heading', { name: en.notes.title.all })).toBeInTheDocument()
    expect(deleted).toBe(true)
  })

  it('says the note is gone when the server answers 404', async () => {
    stubShell()
    server.use(http.get(api('/notes/{note_id}'), () => HttpResponse.json({ detail: 'Not Found' }, { status: 404 })))
    renderApp('/notes/n404')

    expect(await screen.findByText(en.errors.notFound)).toBeInTheDocument()
  })
})
