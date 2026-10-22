import type { CategoryRead, NotePage, NoteRead, UserRead } from '../api/types'

export function category(overrides: Partial<CategoryRead> = {}): CategoryRead {
  return {
    id: 'c1',
    name: 'Home',
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-01T09:00:00Z',
    ...overrides,
  }
}

export function note(overrides: Partial<NoteRead> = {}): NoteRead {
  return {
    id: 'n1',
    title: 'Buy milk',
    body: null,
    due: null,
    status: 'todo',
    categories: [],
    created_at: '2026-10-20T09:00:00Z',
    updated_at: '2026-10-20T09:00:00Z',
    ...overrides,
  }
}

export function page(items: NoteRead[], overrides: Partial<NotePage> = {}): NotePage {
  return { items, total: items.length, limit: 20, offset: 0, ...overrides }
}

export const user: UserRead = {
  id: 'u1',
  username: 'kos',
  email: 'kos@example.com',
  created_at: '2026-10-01T09:00:00Z',
}

export function jwt(exp: number): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'u1', exp })}.signature`
}
