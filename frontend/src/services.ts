import { QueryClient } from '@tanstack/react-query'
import type { RouterHistory } from '@tanstack/react-router'
import { createApi } from './api/client'
import { ApiError } from './api/errors'
import { createSession, type TokenStorage } from './auth/session'
import { createAppRouter } from './router'

export function createAppServices({ storage, history }: { storage: TokenStorage; history?: RouterHistory }) {
  const session = createSession(storage)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failures, error) => failures < 2 && !(error instanceof ApiError && error.status < 500),
      },
    },
  })
  const api = createApi({
    getToken: () => session.getSnapshot().token,
    onUnauthorized: () => session.markExpired(),
  })
  const router = createAppRouter({ session, queryClient }, history)
  return { session, queryClient, api, router }
}

export type AppServices = ReturnType<typeof createAppServices>
