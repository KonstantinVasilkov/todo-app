import { createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { App } from '../app'
import { createAppServices } from '../services'
import type { CategoryRead, NotePage } from '../api/types'
import { jwt, page, user as me } from './fixtures'
import { api, server } from './server'

export function validToken(): string {
  return jwt(Math.floor(Date.now() / 1000) + 3600)
}

export function renderApp(url: string, { signedIn = true } = {}) {
  const history = createMemoryHistory({ initialEntries: [url] })
  const services = createAppServices({ storage: localStorage, history })
  if (signedIn) services.session.signIn(validToken())
  const user = userEvent.setup()
  render(<App {...services} />)
  return { ...services, history, user }
}

export function stubShell(categories: CategoryRead[] = []) {
  server.use(
    http.get(api('/users/me'), () => HttpResponse.json(me)),
    http.get(api('/categories'), () => HttpResponse.json(categories)),
  )
}

export function stubNotes(respond: (query: URLSearchParams) => NotePage = () => page([])) {
  const queries: URLSearchParams[] = []
  server.use(
    http.get(api('/notes'), ({ request }) => {
      const query = new URL(request.url).searchParams
      queries.push(query)
      return HttpResponse.json(respond(query))
    }),
  )
  return queries
}
