import { createContext, useContext, useSyncExternalStore } from 'react'
import type { Api } from './api/client'
import type { Session } from './auth/session'

export interface Services {
  api: Api
  session: Session
}

export const ServicesContext = createContext<Services | null>(null)

function useServices(): Services {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('ServicesContext is missing')
  return services
}

export function useApi(): Api {
  return useServices().api
}

export function useSession(): Session {
  return useServices().session
}

export function useSessionState() {
  const session = useSession()
  return useSyncExternalStore(session.subscribe, session.getSnapshot)
}
