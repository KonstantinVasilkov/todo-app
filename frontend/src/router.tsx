import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, createRoute, createRouter, redirect, type RouterHistory } from '@tanstack/react-router'
import { LoginPage } from './auth/LoginPage'
import { RegisterPage } from './auth/RegisterPage'
import type { Session } from './auth/session'
import { AppLayout } from './components/AppLayout'
import { RootLayout } from './components/RootLayout'
import { CategoriesPage } from './features/categories/CategoriesPage'
import { EditNotePage, NewNotePage } from './features/notes/NoteEditorPages'
import { NotesPage } from './features/notes/NotesPage'
import { parseNotesSearch } from './features/notes/filters'

export interface RouterContext {
  session: Session
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: RootLayout })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
  component: LoginPage,
})

const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/register', component: RegisterPage })

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  beforeLoad: ({ context, location }) => {
    if (!context.session.isAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: AppLayout,
})

const notesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  validateSearch: parseNotesSearch,
  component: NotesPage,
})

const newNoteRoute = createRoute({ getParentRoute: () => appRoute, path: '/notes/new', component: NewNotePage })

const noteRoute = createRoute({ getParentRoute: () => appRoute, path: '/notes/$noteId', component: EditNotePage })

const categoriesRoute = createRoute({ getParentRoute: () => appRoute, path: '/categories', component: CategoriesPage })

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  appRoute.addChildren([notesRoute, newNoteRoute, noteRoute, categoriesRoute]),
])

export function createAppRouter(context: RouterContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, history })
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
