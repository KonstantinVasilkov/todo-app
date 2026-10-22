import { act, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import en from '../../i18n/locales/en.json'
import ru from '../../i18n/locales/ru.json'
import { category, note, page } from '../../test/fixtures'
import { renderApp, stubNotes, stubShell } from '../../test/renderApp'
import { api, server } from '../../test/server'
import type { NoteRead } from '../../api/types'

const DAY_FROM = '2026-10-20T21:00:00.000Z'
const DAY_TO = '2026-10-21T20:59:59.999Z'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-21T11:20:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

function stubHome(today: NoteRead[], undated: NoteRead[]) {
  stubShell([category()])
  return stubNotes((q) => {
    if (q.get('has_due') === 'false') return page(undated)
    if (q.get('due_from') === DAY_FROM) return page(today)
    return page([])
  })
}

function todayRows() {
  const section = screen.getByRole('region', { name: new RegExp(en.today.title) })
  return within(section).getAllByRole('listitem')
}

describe('Today list', () => {
  it('requests the local day and sorts rows by time with a now line', async () => {
    const queries = stubHome(
      [
        note({ id: 'a', title: 'Evening', due: '2026-10-21T16:00:00Z' }),
        note({ id: 'b', title: 'Morning', due: '2026-10-21T06:00:00Z' }),
        note({ id: 'c', title: 'Anytime', due: '2026-10-21T20:59:59Z' }),
      ],
      [],
    )
    renderApp('/')
    await screen.findByText('Morning')
    expect(queries.some((q) => q.get('due_from') === DAY_FROM && q.get('due_to') === DAY_TO)).toBe(true)
    const rows = todayRows()
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveTextContent('Morning')
    expect(rows[1]).toHaveAttribute('aria-label', en.calendar.now)
    expect(rows[2]).toHaveTextContent('Evening')
    expect(rows[3]).toHaveTextContent('Anytime')
    expect(rows[3]).toHaveTextContent(en.today.allDay)
    expect(rows[0]).toHaveTextContent('09:00')
  })

  it('shows done notes struck and checked', async () => {
    stubHome([note({ id: 'a', title: 'Finished', status: 'done', due: '2026-10-21T06:00:00Z' })], [])
    renderApp('/')
    const box = await screen.findByRole('checkbox', { name: en.notes.markDone.replace('{{title}}', 'Finished') })
    expect(box).toBeChecked()
  })

  it('shows the empty state', async () => {
    stubHome([], [])
    renderApp('/')
    expect(await screen.findByText(en.today.empty)).toBeInTheDocument()
  })
})

describe('No date list', () => {
  it('requests open undated notes and hides done ones', async () => {
    const queries = stubHome(
      [],
      [note({ id: 'a', title: 'Open' }), note({ id: 'b', title: 'Closed', status: 'done' }), note({ id: 'c', title: 'Plain', status: null })],
    )
    renderApp('/')
    await screen.findByText('Open')
    expect(screen.queryByText('Closed')).not.toBeInTheDocument()
    expect(screen.getByText('Plain')).toBeInTheDocument()
    const query = queries.find((q) => q.get('has_due') === 'false')
    expect(query?.getAll('status').sort()).toEqual(['in_progress', 'none', 'todo'])
  })

  it('checks the box before the server answers and sends done', async () => {
    stubHome([], [note({ id: 'a', title: 'Open' })])
    let body: unknown
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.patch(api('/notes/{note_id}'), async ({ request }) => {
        body = await request.json()
        await gate
        return HttpResponse.json(note({ id: 'a', title: 'Open', status: 'done' }))
      }),
    )
    const { user } = renderApp('/')
    const box = await screen.findByRole('checkbox', { name: en.notes.markDone.replace('{{title}}', 'Open') })
    await user.click(box)
    await waitFor(() => expect(body).toEqual({ status: 'done' }))
    expect(screen.queryByRole('checkbox', { name: en.notes.markDone.replace('{{title}}', 'Open') })).not.toBeInTheDocument()
    release()
  })
})

describe('language', () => {
  it('translates the headings', async () => {
    stubHome([], [])
    renderApp('/')
    await screen.findByText(en.today.empty)
    await act(() => i18n.changeLanguage('ru'))
    expect(await screen.findByRole('heading', { name: new RegExp(ru.today.title) })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: new RegExp(ru.noDate.title) })).toBeInTheDocument()
  })
})
