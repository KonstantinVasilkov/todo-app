import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useMemo } from 'react'
import { ServicesContext } from './context'
import type { AppServices } from './services'

export function App({ session, queryClient, api, router }: AppServices) {
  const services = useMemo(() => ({ api, session }), [api, session])
  return (
    <ServicesContext.Provider value={services}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ServicesContext.Provider>
  )
}
