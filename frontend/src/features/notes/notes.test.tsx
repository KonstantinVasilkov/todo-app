import { act, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import en from '../../i18n/locales/en.json'
import ru from '../../i18n/locales/ru.json'
import { category, note, page } from '../../test/fixtures'
import { renderApp, stubNotes, stubShell } from '../../test/renderApp'
import { api, server } from '../../test/server'

const markDone = (title: string) => en.notes.markDone.replace('{{title}}', title)

const NOW = new Date('2026-10-21T09:00:00Z')

beforeEach(() => {

  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => vi.useRealTimers())

describe('notes list', () => {
  it('shows each note with its due, overdue mark and categories', async () => {
    stubShell()
    stubNotes(() =>
      page([
        note({ id: 'n1', title: 'Submit report', due: '2026-10-20T20:59:59Z', categories: [category({ name: 'Work' })] }),
        note({ id: 'n2', title: 'Article idea', status: null }),
      ]),
    )
    renderApp('/notes')

    const late = (await screen.findByText('Submit report')).closest('li')!
    expect(within(late).getByText('yesterday')).toHaveClass('overdue')
    expect(within(late).getByText('Work')).toBeInTheDocument()
    expect(within(late).getByRole('checkbox', { name: markDone('Submit report') })).not.toBeChecked()

    const plain = screen.getByText('Article idea').closest('li')!
    expect(within(plain).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('requests the filters written in the URL', async () => {
    stubShell()
    const queries = stubNotes()
    renderApp('/notes?due=overdue')

    expect(await screen.findByRole('heading', { name: en.notes.title.overdue })).toBeInTheDocument()
    await waitFor(() => expect(queries).toHaveLength(1))
    expect(queries[0].getAll('status')).toEqual(['todo', 'in_progress'])
    expect(queries[0].get('due_to')).toBe('2026-10-21T09:00:00.000Z')
    expect(queries[0].get('offset')).toBe('0')
  })

  it('switches views and status filters through the URL', async () => {
    stubShell([category({ id: 'c1', name: 'Home' })])
    const queries = stubNotes()
    const { user, history } = renderApp('/notes')
    await screen.findByRole('heading', { name: en.notes.title.all })

    await user.click(screen.getByRole('link', { name: en.filters.view.none }))
    await waitFor(() => expect(queries.at(-1)!.get('has_due')).toBe('false'))
    const views = within(screen.getByRole('navigation', { name: en.filters.views }))
    expect(views.getByRole('link', { name: en.filters.view.none })).toHaveAttribute('aria-current', 'page')
    expect(views.getByRole('link', { name: en.filters.view.all })).not.toHaveAttribute('aria-current')

    await user.click(screen.getByRole('checkbox', { name: en.status.none }))
    await waitFor(() => expect(queries.at(-1)!.getAll('status')).toEqual(['none']))

    await user.click(screen.getByRole('checkbox', { name: 'Home' }))
    await waitFor(() => expect(queries.at(-1)!.getAll('category_id')).toEqual(['c1']))
    expect(history.location.pathname).toBe('/notes')
    expect(history.location.search).toContain('due=none')
  })

  it('marks a task done at once and saves the new status', async () => {
    stubShell()
    stubNotes(() => page([note({ id: 'n1', title: 'Buy milk', status: 'todo' })]))
    let patch: unknown = null
    let release: () => void = () => {}
    server.use(
      http.patch(api('/notes/{note_id}'), async ({ request }) => {
        patch = await request.json()
        await new Promise<void>((resolve) => (release = resolve))
        return HttpResponse.json(note({ id: 'n1', title: 'Buy milk', status: 'done' }))
      }),
    )
    const { user } = renderApp('/notes')

    const box = await screen.findByRole('checkbox', { name: markDone('Buy milk') })
    await user.click(box)


    await waitFor(() => expect(box).toBeChecked())
    await waitFor(() => expect(patch).toEqual({ status: 'done' }))
    release()
  })

  it('puts the checkbox back when saving fails', async () => {
    stubShell()
    stubNotes(() => page([note({ id: 'n1', title: 'Buy milk', status: 'todo' })]))
    server.use(http.patch(api('/notes/{note_id}'), () => HttpResponse.json({ detail: 'boom' }, { status: 500 })))
    const { user } = renderApp('/notes')

    const box = await screen.findByRole('checkbox', { name: markDone('Buy milk') })
    await user.click(box)

    await waitFor(() => expect(screen.getByRole('checkbox', { name: markDone('Buy milk') })).not.toBeChecked())
    expect(await screen.findByRole('alert')).toHaveTextContent(en.errors.server)
  })

  it('loads the next page on demand', async () => {
    stubShell()
    const first = Array.from({ length: 20 }, (_, i) => note({ id: `a${i}`, title: `Note ${i}` }))
    const second = Array.from({ length: 5 }, (_, i) => note({ id: `b${i}`, title: `More ${i}` }))
    const queries = stubNotes((q) =>
      q.get('offset') === '0' ? page(first, { total: 25 }) : page(second, { total: 25, offset: 20 }),
    )
    const { user } = renderApp('/notes')

    expect(await screen.findByText(en.notes.shown.replace('{{shown}}', '20').replace('{{total}}', '25'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en.notes.loadMore }))

    expect(await screen.findByText('More 4')).toBeInTheDocument()
    expect(queries.at(-1)!.get('offset')).toBe('20')
    expect(screen.queryByRole('button', { name: en.notes.loadMore })).not.toBeInTheDocument()
  })

  it('says when nothing matches', async () => {
    stubShell()
    stubNotes(() => page([]))
    renderApp('/notes?due=today')

    expect(await screen.findByText(en.notes.empty)).toBeInTheDocument()
  })

  it('renders the page in Russian after switching language', async () => {
    stubShell()
    stubNotes()
    renderApp('/notes')
    await screen.findByRole('heading', { name: en.notes.title.all })

    await act(() => i18n.changeLanguage('ru'))

    expect(await screen.findByRole('heading', { name: ru.notes.title.all })).toBeInTheDocument()
  })
})
