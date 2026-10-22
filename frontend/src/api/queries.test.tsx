import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { createSession } from '../auth/session'
import { ServicesContext } from '../context'
import { note, page } from '../test/fixtures'
import { api as apiPath, server } from '../test/server'
import { createApi } from './client'
import { useAllNotes } from './queries'

function wrapper({ children }: { children: ReactNode }) {
  const session = createSession(localStorage)
  const api = createApi({ getToken: () => null, onUnauthorized: () => {} })
  return (
    <ServicesContext.Provider value={{ api, session }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
      </QueryClientProvider>
    </ServicesContext.Provider>
  )
}

describe('useAllNotes', () => {
  it('loads every page of a range until the total is reached', async () => {
    const all = Array.from({ length: 150 }, (_, i) => note({ id: `n${i}`, title: `Note ${i}` }))
    const requests: URLSearchParams[] = []
    server.use(
      http.get(apiPath('/notes'), ({ request }) => {
        const query = new URL(request.url).searchParams
        requests.push(query)
        const offset = Number(query.get('offset'))
        const limit = Number(query.get('limit'))
        return HttpResponse.json(page(all.slice(offset, offset + limit), { total: all.length, limit, offset }))
      }),
    )

    const { result } = renderHook(
      () => useAllNotes({ due_from: '2026-10-01T00:00:00.000Z', due_to: '2026-10-31T23:59:59.999Z' }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.data).toHaveLength(150))
    expect(requests.map((q) => [q.get('offset'), q.get('limit')])).toEqual([
      ['0', '100'],
      ['100', '100'],
    ])
    expect(requests[0].get('due_from')).toBe('2026-10-01T00:00:00.000Z')
  })
})
