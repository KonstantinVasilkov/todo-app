import { act, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import en from '../../i18n/locales/en.json'
import { renderApp, stubNotes, stubShell } from '../../test/renderApp'
import { category, note, page } from '../../test/fixtures'
import { api, server } from '../../test/server'

const ranged = (query: URLSearchParams) => query.has('due_from') && query.get('due_from') !== query.get('due_to')
const gridQueries = (queries: URLSearchParams[]) =>
  queries.filter((query) => query.get('due_to') !== null && query.get('due_from')?.endsWith('21:00:00.000Z') && ranged(query))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-21T11:20:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('calendar', () => {
  it('puts notes into their day cells and marks done and overdue', async () => {
    stubShell([category()])
    stubNotes(() =>
      page([
        note({ id: 'n1', title: 'Dentist', due: '2026-10-22T07:00:00Z' }),
        note({ id: 'n2', title: 'Report', due: '2026-10-10T09:00:00Z', status: 'done' }),
        note({ id: 'n3', title: 'Rent', due: '2026-10-05T09:00:00Z', status: 'todo' }),
      ]),
    )
    renderApp('/')
    const dentist = (await screen.findAllByText('Dentist'))[0]
    expect(dentist.closest('[data-day]')).toHaveAttribute('data-day', '2026-10-22')
    const calendar = document.querySelector('.calendar') as HTMLElement
    const report = within(calendar).getByText('Report').closest('a')
    expect(report?.closest('[data-day]')).toHaveAttribute('data-day', '2026-10-10')
    expect(report).toHaveClass('is-done')
    const rent = within(calendar).getByText('Rent').closest('a')
    expect(rent).toHaveClass('is-overdue')
    expect(within(calendar).getByText('Dentist').closest('a')).not.toHaveClass('is-overdue')
  })

  it('labels times only where there is room: today in the month, every day in the week', async () => {
    stubShell()
    stubNotes(() =>
      page([
        note({ id: 'n1', title: 'Standup', due: '2026-10-21T06:30:00Z' }),
        note({ id: 'n2', title: 'Dentist', due: '2026-10-22T07:00:00Z' }),
      ]),
    )
    const { user } = renderApp('/')
    const calendar = (await screen.findAllByText('Dentist'))[0].closest('.calendar') as HTMLElement

    expect(within(calendar).getByText('Standup').closest('a')).toHaveTextContent('9:30 AM')
    expect(within(calendar).getByText('Dentist').closest('a')).toHaveTextContent(/^Dentist$/)

    await user.click(within(calendar).getByRole('button', { name: en.calendar.week }))

    expect(await within(calendar).findByText('10:00 AM')).toBeInTheDocument()
  })

  it('requests the visible grid range', async () => {
    stubShell()
    const queries = stubNotes()
    renderApp('/')
    await waitFor(() => expect(gridQueries(queries).length).toBeGreaterThan(0))
    const [query] = gridQueries(queries)
    expect(query.get('due_from')).toBe('2026-09-26T21:00:00.000Z')
    expect(query.get('due_to')).toBe('2026-10-31T20:59:59.999Z')
  })

  it('shows a more button when a day has too many notes', async () => {
    stubShell()
    stubNotes(() =>
      page(
        Array.from({ length: 8 }, (_, index) =>
          note({ id: `m${index}`, title: `Item ${index}`, due: `2026-10-22T0${index}:00:00Z` }),
        ),
      ),
    )
    const { user, history } = renderApp('/')
    const more = await screen.findByRole('button', { name: /more/ })
    expect(more.closest('[data-day]')).toHaveAttribute('data-day', '2026-10-22')
    const hidden = more.textContent?.match(/\d+/)?.[0] ?? ''
    expect(more).toHaveTextContent(en.calendar.more.replace('{{hidden}}', hidden))
    await user.click(more)
    await waitFor(() => expect(history.location.search).toContain('view=week'))
    expect(history.location.search).toContain('date=2026-10-22')
  })

  it('opens the editor when a note is clicked', async () => {
    stubShell()
    stubNotes(() => page([note({ id: 'n1', title: 'Dentist', due: '2026-10-22T07:00:00Z' })]))
    server.use(
      http.get(api('/notes/{note_id}'), () =>
        HttpResponse.json(note({ id: 'n1', title: 'Dentist', due: '2026-10-22T07:00:00Z' })),
      ),
    )
    const { user, history } = renderApp('/')
    const link = (await screen.findAllByText('Dentist'))[0]
    await user.click(link)
    await waitFor(() => expect(history.location.pathname).toBe('/notes/n1'))
  })

  it('creates a note on the clicked day', async () => {
    stubShell()
    stubNotes()
    const { user, history } = renderApp('/')
    const label = en.calendar.addNote.replace('{{date}}', 'Thursday, October 22, 2026')
    await user.click(await screen.findByRole('button', { name: label }))
    await waitFor(() => expect(history.location.pathname).toBe('/notes/new'))
    expect(history.location.search).toContain('date=2026-10-22')
  })

  it('switches to the week view', async () => {
    stubShell()
    const queries = stubNotes()
    const { user, history } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: en.calendar.week }))
    await waitFor(() => expect(history.location.search).toContain('view=week'))
    expect(document.querySelectorAll('.cal-day')).toHaveLength(7)
    await waitFor(() =>
      expect(queries.some((query) => query.get('due_from') === '2026-10-17T21:00:00.000Z')).toBe(true),
    )
    const week = queries.find((query) => query.get('due_from') === '2026-10-17T21:00:00.000Z')
    expect(week?.get('due_to')).toBe('2026-10-24T20:59:59.999Z')
  })

  it('moves to the next month', async () => {
    stubShell()
    stubNotes()
    const { user, history } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: en.calendar.next }))
    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    expect(history.location.search).toContain('date=2026-11-01')
  })

  it('starts the week on Monday in Russian', async () => {
    stubShell()
    stubNotes()
    renderApp('/')
    await screen.findByRole('heading', { name: 'October 2026' })
    await act(() => i18n.changeLanguage('ru'))
    await waitFor(() => expect(document.querySelector('.cal-day')).toHaveAttribute('data-day', '2026-09-28'))
    await act(() => i18n.changeLanguage('en'))
  })
})
