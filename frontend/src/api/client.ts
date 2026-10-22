import createClient, { type Middleware } from 'openapi-fetch'
import { ApiError } from './errors'
import type { ListNotesParams, NoteCreate, NoteUpdate, paths, RegisterRequest } from './types'

const BASE = '/api'

export interface ApiOptions {
  getToken: () => string | null
  onUnauthorized: () => void
}

async function unwrap<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await call
  if (!response.ok) {
    const detail = (error as { detail?: unknown } | undefined)?.detail
    throw new ApiError(response.status, detail ?? response.statusText)
  }
  return data as T
}

export function createApi({ getToken, onUnauthorized }: ApiOptions) {
  const client = createClient<paths>({
    baseUrl: new URL(BASE, window.location.origin).href,
    fetch: (request) => globalThis.fetch(request),
  })

  const auth: Middleware = {
    onRequest({ request }) {
      const token = getToken()
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
      return request
    },
    onResponse({ request, response }) {
      if (response.status === 401 && request.headers.has('Authorization')) onUnauthorized()
      return response
    },
  }
  client.use(auth)

  return {
    login: (username: string, password: string) =>
      unwrap(
        client.POST('/auth/login', {
          body: { username, password },
          bodySerializer: () => new URLSearchParams({ username, password }),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      ),
    register: (body: RegisterRequest) => unwrap(client.POST('/auth/register', { body })),
    me: () => unwrap(client.GET('/users/me')),

    listNotes: (query: ListNotesParams) => unwrap(client.GET('/notes', { params: { query } })),
    getNote: (id: string) => unwrap(client.GET('/notes/{note_id}', { params: { path: { note_id: id } } })),
    createNote: (body: NoteCreate) => unwrap(client.POST('/notes', { body })),
    updateNote: (id: string, body: NoteUpdate) =>
      unwrap(client.PATCH('/notes/{note_id}', { params: { path: { note_id: id } }, body })),
    deleteNote: async (id: string): Promise<void> => {
      await unwrap(client.DELETE('/notes/{note_id}', { params: { path: { note_id: id } } }))
    },

    listCategories: () => unwrap(client.GET('/categories')),
    createCategory: (name: string) => unwrap(client.POST('/categories', { body: { name } })),
    renameCategory: (id: string, name: string) =>
      unwrap(client.PATCH('/categories/{category_id}', { params: { path: { category_id: id } }, body: { name } })),
    deleteCategory: async (id: string): Promise<void> => {
      await unwrap(client.DELETE('/categories/{category_id}', { params: { path: { category_id: id } } }))
    },
  }
}

export type Api = ReturnType<typeof createApi>
