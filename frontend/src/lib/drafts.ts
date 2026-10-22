const PREFIX = 'todo.draft.'

interface Stored {
  base: string | null
  values: unknown
}

export function saveDraft(key: string, base: string | null, values: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ base, values } satisfies Stored))
  } catch {}
}

export function loadDraft<T>(key: string, base: string | null): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const stored = JSON.parse(raw) as Stored
    return stored.base === base ? (stored.values as T) : null
  } catch {
    return null
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {}
}
