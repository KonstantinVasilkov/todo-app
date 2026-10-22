import { describe, expect, it, vi } from 'vitest'
import { jwt } from '../test/fixtures'
import { createSession } from './session'

const NOW = Date.parse('2026-10-21T12:00:00Z')
const inAnHour = NOW / 1000 + 3600
const aMinuteAgo = NOW / 1000 - 60

describe('session', () => {
  it('restores a stored token after a reload', () => {
    createSession(localStorage).signIn(jwt(inAnHour))

    const reloaded = createSession(localStorage)

    expect(reloaded.getSnapshot().token).toBe(jwt(inAnHour))
    expect(reloaded.isAuthenticated(NOW)).toBe(true)
  })

  it('is not authenticated once the token has expired', () => {
    const session = createSession(localStorage)
    session.signIn(jwt(aMinuteAgo))

    expect(session.isAuthenticated(NOW)).toBe(false)
  })

  it('is not authenticated with a token it cannot decode', () => {
    const session = createSession(localStorage)
    session.signIn('not-a-jwt')

    expect(session.isAuthenticated(NOW)).toBe(false)
  })

  it('forgets the token and flags the session as expired', () => {
    const session = createSession(localStorage)
    session.signIn(jwt(inAnHour))

    session.markExpired()

    expect(session.getSnapshot()).toEqual({ token: null, expired: true })
    expect(createSession(localStorage).getSnapshot().token).toBeNull()
  })

  it('clears the expired flag on the next sign-in', () => {
    const session = createSession(localStorage)
    session.markExpired()

    session.signIn(jwt(inAnHour))

    expect(session.getSnapshot()).toEqual({ token: jwt(inAnHour), expired: false })
  })

  it('signs out without flagging expiry', () => {
    const session = createSession(localStorage)
    session.signIn(jwt(inAnHour))

    session.signOut()

    expect(session.getSnapshot()).toEqual({ token: null, expired: false })
    expect(createSession(localStorage).getSnapshot().token).toBeNull()
  })

  it('notifies subscribers and keeps the snapshot stable between changes', () => {
    const session = createSession(localStorage)
    const listener = vi.fn()
    session.subscribe(listener)
    const before = session.getSnapshot()

    expect(session.getSnapshot()).toBe(before)
    session.signIn(jwt(inAnHour))

    expect(listener).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot()).not.toBe(before)
  })

  it('keeps the session in memory when storage is unavailable', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }

    const session = createSession(broken)
    session.signIn(jwt(inAnHour))

    expect(session.isAuthenticated(NOW)).toBe(true)
  })
})
