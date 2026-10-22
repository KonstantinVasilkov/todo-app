export interface SessionSnapshot {
  token: string | null
  expired: boolean
}

export type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const KEY = 'todo.token'

function readExp(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const exp = JSON.parse(atob(payload)).exp
    return typeof exp === 'number' ? exp : null
  } catch {
    return null
  }
}

export function createSession(storage: TokenStorage) {
  const listeners = new Set<() => void>()
  let snapshot: SessionSnapshot = { token: read(), expired: false }

  function read(): string | null {
    try {
      return storage.getItem(KEY)
    } catch {
      return null
    }
  }

  function write(token: string | null) {
    try {
      if (token) storage.setItem(KEY, token)
      else storage.removeItem(KEY)
    } catch {}
  }

  function update(next: SessionSnapshot) {
    write(next.token)
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isAuthenticated(now = Date.now()) {
      const exp = snapshot.token ? readExp(snapshot.token) : null
      return exp !== null && exp * 1000 > now
    },
    signIn: (token: string) => update({ token, expired: false }),
    signOut: () => update({ token: null, expired: false }),
    markExpired: () => update({ token: null, expired: true }),
  }
}

export type Session = ReturnType<typeof createSession>
