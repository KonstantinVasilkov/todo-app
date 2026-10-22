import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { createAppServices } from './services'
import type { TokenStorage } from './auth/session'
import './i18n'
import './index.css'

function tokenStorage(): TokenStorage {
  try {
    return window.localStorage
  } catch {
    const memory = new Map<string, string>()
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    }
  }
}

const services = createAppServices({ storage: tokenStorage() })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App {...services} />
  </StrictMode>,
)
