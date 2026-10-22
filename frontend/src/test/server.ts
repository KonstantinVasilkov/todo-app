import { setupServer } from 'msw/node'
import type { paths } from '../api/types'

export const server = setupServer()

const API = 'http://localhost:3000/api'

export function api(path: keyof paths): string {
  return API + path.replace(/\{(\w+)\}/g, ':$1')
}
