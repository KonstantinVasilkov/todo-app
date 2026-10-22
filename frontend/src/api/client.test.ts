import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { api, server } from '../test/server'
import { note } from '../test/fixtures'
import { createApi } from './client'
import { ApiError } from './errors'

function apiWith(token: string | null, onUnauthorized = vi.fn()) {
  return { api: createApi({ getToken: () => token, onUnauthorized }), onUnauthorized }
}

describe('createApi', () => {
  it('sends the bearer token with authenticated requests', async () => {
    let auth: string | null = null
    server.use(
      http.get(api('/users/me'), ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json({ id: 'u1', username: 'kos', email: 'k@x.io', created_at: '2026-10-21T10:00:00Z' })
      }),
    )

    const me = await apiWith('tok-1').api.me()

    expect(auth).toBe('Bearer tok-1')
    expect(me.username).toBe('kos')
  })

  it('repeats list filters and drops the unset ones', async () => {
    let query = ''
    server.use(
      http.get(api('/notes'), ({ request }) => {
        query = new URL(request.url).search
        return HttpResponse.json({ items: [], total: 0, limit: 20, offset: 40 })
      }),
    )

    await apiWith('t').api.listNotes({
      status: ['todo', 'none'],
      category_id: ['c1', 'c2'],
      has_due: false,
      due_from: undefined,
      due_to: null,
      limit: 20,
      offset: 40,
    })

    expect(query).toBe('?status=todo&status=none&category_id=c1&category_id=c2&has_due=false&limit=20&offset=40')
  })

  it('logs in with an OAuth2 form, not JSON', async () => {
    let contentType: string | null = null
    let form: URLSearchParams | null = null
    server.use(
      http.post(api('/auth/login'), async ({ request }) => {
        contentType = request.headers.get('Content-Type')
        form = new URLSearchParams(await request.text())
        return HttpResponse.json({ access_token: 'jwt', token_type: 'bearer' })
      }),
    )

    const token = await apiWith(null).api.login('kos', 'p@ss word')

    expect(contentType).toContain('application/x-www-form-urlencoded')
    expect(form!.get('username')).toBe('kos')
    expect(form!.get('password')).toBe('p@ss word')
    expect(token.access_token).toBe('jwt')
  })

  it('sends PATCH bodies as JSON and keeps explicit nulls', async () => {
    let body: unknown = null
    server.use(
      http.patch(api('/notes/{note_id}'), async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(note({ id: 'n1', due: null }))
      }),
    )

    await apiWith('t').api.updateNote('n1', { due: null, title: 'Renamed' })

    expect(body).toEqual({ due: null, title: 'Renamed' })
  })

  it('resolves a 204 delete without a body', async () => {
    server.use(http.delete(api('/notes/{note_id}'), () => new HttpResponse(null, { status: 204 })))

    await expect(apiWith('t').api.deleteNote('n1')).resolves.toBeUndefined()
  })

  it('throws ApiError with the response detail', async () => {
    const detail = [{ loc: ['body', 'name'], msg: 'taken', type: 'conflict' }]
    server.use(http.post(api('/categories'), () => HttpResponse.json({ detail }, { status: 409 })))

    const error = await apiWith('t').api.createCategory('Home').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(409)
    expect((error as ApiError).detail).toEqual(detail)
  })

  it('reports an expired session when a token gets 401', async () => {
    server.use(http.get(api('/notes/{note_id}'), () => HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })))
    const { api: client, onUnauthorized } = apiWith('stale')

    await expect(client.getNote('n1')).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('treats 401 without a token as a plain failure, e.g. a wrong password', async () => {
    server.use(http.post(api('/auth/login'), () => HttpResponse.json({ detail: 'Bad credentials' }, { status: 401 })))
    const { api: client, onUnauthorized } = apiWith(null)

    await expect(client.login('kos', 'wrong')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
