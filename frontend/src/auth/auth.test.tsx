import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import en from '../i18n/locales/en.json'
import ru from '../i18n/locales/ru.json'
import { LANGUAGE_STORAGE_KEY } from '../i18n'
import { note, page, user as me } from '../test/fixtures'
import { renderApp, stubNotes, stubShell, validToken } from '../test/renderApp'
import { api, server } from '../test/server'

describe('sign in', () => {
  it('sends a signed-out visitor to the login page and back after signing in', async () => {
    stubShell()
    let form: URLSearchParams | null = null
    server.use(
      http.post(api('/auth/login'), async ({ request }) => {
        form = new URLSearchParams(await request.text())
        return HttpResponse.json({ access_token: validToken(), token_type: 'bearer' })
      }),
    )
    const { user, session } = renderApp('/categories', { signedIn: false })

    expect(await screen.findByRole('heading', { name: en.auth.login.title })).toBeInTheDocument()
    await user.type(screen.getByLabelText(en.auth.username), 'kos')
    await user.type(screen.getByLabelText(en.auth.password), 'secret-pass')
    await user.click(screen.getByRole('button', { name: en.auth.login.submit }))

    expect(await screen.findByRole('heading', { name: en.categories.title })).toBeInTheDocument()
    const sections = within(screen.getByRole('navigation', { name: en.nav.sections }))
    expect(sections.getByRole('link', { name: en.nav.categories })).toHaveAttribute('aria-current', 'page')
    expect(sections.getByRole('link', { name: en.nav.notes })).not.toHaveAttribute('aria-current')
    expect(form!.get('username')).toBe('kos')
    expect(session.isAuthenticated()).toBe(true)
  })

  it('says so when the password is wrong', async () => {
    server.use(http.post(api('/auth/login'), () => HttpResponse.json({ detail: 'Bad credentials' }, { status: 401 })))
    const { user } = renderApp('/login', { signedIn: false })

    await user.type(await screen.findByLabelText(en.auth.username), 'kos')
    await user.type(screen.getByLabelText(en.auth.password), 'wrong-pass')
    await user.click(screen.getByRole('button', { name: en.auth.login.submit }))

    expect(await screen.findByRole('alert')).toHaveTextContent(en.auth.login.wrongCredentials)
    expect(screen.getByRole('heading', { name: en.auth.login.title })).toBeInTheDocument()
  })
})

describe('language', () => {
  it('switches the login page to Russian and remembers the choice', async () => {
    const { user } = renderApp('/login', { signedIn: false })

    await user.selectOptions(await screen.findByRole('combobox', { name: en.language.label }), 'ru')

    expect(await screen.findByRole('heading', { name: ru.auth.login.title })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('ru')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ru')
  })
})

describe('registration', () => {
  it('registers, signs in and opens the notes', async () => {
    stubShell()
    stubNotes(() => page([]))
    let registered: unknown = null
    server.use(
      http.post(api('/auth/register'), async ({ request }) => {
        registered = await request.json()
        return HttpResponse.json(me, { status: 201 })
      }),
      http.post(api('/auth/login'), () => HttpResponse.json({ access_token: validToken(), token_type: 'bearer' })),
    )
    const { user } = renderApp('/register', { signedIn: false })

    await user.type(await screen.findByLabelText(en.auth.username), 'kos')
    await user.type(screen.getByLabelText(en.auth.email), 'kos@example.com')
    await user.type(screen.getByLabelText(en.auth.password), 'secret-pass')
    await user.click(screen.getByRole('button', { name: en.auth.register.submit }))

    expect(await screen.findByRole('heading', { name: en.notes.title.all })).toBeInTheDocument()
    expect(registered).toEqual({ username: 'kos', email: 'kos@example.com', password: 'secret-pass' })
  })

  it('marks the field the server says is taken', async () => {
    server.use(
      http.post(api('/auth/register'), () =>
        HttpResponse.json(
          { detail: [{ loc: ['body', 'email'], msg: 'Email already registered', type: 'conflict' }] },
          { status: 409 },
        ),
      ),
    )
    const { user } = renderApp('/register', { signedIn: false })

    await user.type(await screen.findByLabelText(en.auth.username), 'kos')
    await user.type(screen.getByLabelText(en.auth.email), 'kos@example.com')
    await user.type(screen.getByLabelText(en.auth.password), 'secret-pass')
    await user.click(screen.getByRole('button', { name: en.auth.register.submit }))

    await waitFor(() => expect(screen.getByLabelText(en.auth.email)).toHaveAccessibleDescription(en.errors.conflict.email))
    expect(screen.getByLabelText(en.auth.email)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(en.auth.username)).not.toHaveAttribute('aria-invalid', 'true')
  })
})

describe('expired session', () => {
  it('asks to sign in again on top of the page and reloads what failed', async () => {
    stubShell()
    let expired = true
    server.use(
      http.get(api('/notes'), () =>
        expired
          ? HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
          : HttpResponse.json(page([note({ title: 'After sign in' })])),
      ),
      http.post(api('/auth/login'), () => {
        expired = false
        return HttpResponse.json({ access_token: validToken(), token_type: 'bearer' })
      }),
    )
    const { user } = renderApp('/')

    const dialog = await screen.findByRole('dialog', { name: en.auth.relogin.title })
    await user.type(within(dialog).getByLabelText(en.auth.username), 'kos')
    await user.type(within(dialog).getByLabelText(en.auth.password), 'secret-pass')
    await user.click(within(dialog).getByRole('button', { name: en.auth.login.submit }))

    expect(await screen.findByText('After sign in')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps what the user typed when saving hits an expired session', async () => {
    stubShell()
    stubNotes()
    const created: unknown[] = []
    let expired = true
    server.use(
      http.post(api('/notes'), async ({ request }) => {
        if (expired) return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
        const body = await request.json()
        created.push(body)
        return HttpResponse.json(note({ title: 'Important' }), { status: 201 })
      }),
      http.post(api('/auth/login'), () => {
        expired = false
        return HttpResponse.json({ access_token: validToken(), token_type: 'bearer' })
      }),
    )
    const { user } = renderApp('/notes/new')

    await user.type(await screen.findByLabelText(en.editor.fields.title), 'Important')
    await user.click(screen.getByRole('button', { name: en.editor.create }))
    const dialog = await screen.findByRole('dialog', { name: en.auth.relogin.title })
    await user.type(within(dialog).getByLabelText(en.auth.username), 'kos')
    await user.type(within(dialog).getByLabelText(en.auth.password), 'secret-pass')
    await user.click(within(dialog).getByRole('button', { name: en.auth.login.submit }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(screen.getByLabelText(en.editor.fields.title)).toHaveValue('Important')
    await user.click(screen.getByRole('button', { name: en.editor.create }))
    expect(await screen.findByRole('heading', { name: en.notes.title.all })).toBeInTheDocument()
    expect(created).toEqual([{ title: 'Important', status: 'todo', category_ids: [] }])
  })
})
