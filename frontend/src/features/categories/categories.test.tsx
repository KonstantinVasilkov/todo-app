import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { CategoryRead } from '../../api/types'
import i18n from '../../i18n'
import en from '../../i18n/locales/en.json'
import ru from '../../i18n/locales/ru.json'
import { category, user as me } from '../../test/fixtures'
import { renderApp } from '../../test/renderApp'
import { api, server } from '../../test/server'

function categoriesBackend(initial: CategoryRead[]) {
  let items = [...initial]
  const calls: { method: string; id?: string; body?: unknown }[] = []
  server.use(
    http.get(api('/users/me'), () => HttpResponse.json(me)),
    http.get(api('/categories'), () => HttpResponse.json(items)),
    http.post(api('/categories'), async ({ request }) => {
      const body = (await request.json()) as { name: string }
      calls.push({ method: 'POST', body })
      if (items.some((c) => c.name === body.name)) {
        return HttpResponse.json(
          { detail: [{ loc: ['body', 'name'], msg: 'Category already exists', type: 'conflict' }] },
          { status: 409 },
        )
      }
      const created = category({ id: `c${items.length + 1}`, name: body.name })
      items = [...items, created]
      return HttpResponse.json(created, { status: 201 })
    }),
    http.patch(api('/categories/{category_id}'), async ({ request, params }) => {
      const body = (await request.json()) as { name: string }
      calls.push({ method: 'PATCH', id: String(params.category_id), body })
      items = items.map((c) => (c.id === params.category_id ? { ...c, name: body.name } : c))
      return HttpResponse.json(items.find((c) => c.id === params.category_id))
    }),
    http.delete(api('/categories/{category_id}'), ({ params }) => {
      calls.push({ method: 'DELETE', id: String(params.category_id) })
      items = items.filter((c) => c.id !== params.category_id)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('categories', () => {
  it('adds a category to the list', async () => {
    categoriesBackend([category({ id: 'c1', name: 'Home' })])
    const { user } = renderApp('/categories')

    await user.type(await screen.findByLabelText(en.categories.new), 'Work')
    await user.click(screen.getByRole('button', { name: en.categories.add }))

    const list = screen.getByRole('list', { name: en.categories.list })
    expect(await within(list).findByText('Work')).toBeInTheDocument()
    expect(screen.getByLabelText(en.categories.new)).toHaveValue('')
  })

  it('marks a name that is already taken', async () => {
    categoriesBackend([category({ id: 'c1', name: 'Home' })])
    const { user } = renderApp('/categories')

    await user.type(await screen.findByLabelText(en.categories.new), 'Home')
    await user.click(screen.getByRole('button', { name: en.categories.add }))

    await waitFor(() => expect(screen.getByLabelText(en.categories.new)).toHaveAccessibleDescription(en.errors.conflict.name))
  })

  it('renames a category in place', async () => {
    const calls = categoriesBackend([category({ id: 'c1', name: 'Home' })])
    const { user } = renderApp('/categories')

    await user.click(await screen.findByRole('button', { name: en.categories.renameNamed.replace('{{name}}', 'Home') }))
    const input = screen.getByLabelText(en.categories.name)
    await user.clear(input)
    await user.type(input, 'Flat')
    await user.click(screen.getByRole('button', { name: en.common.save }))

    expect(await screen.findByText('Flat')).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'PATCH', id: 'c1', body: { name: 'Flat' } }])
  })

  it('deletes a category only after a second confirmation', async () => {
    const calls = categoriesBackend([category({ id: 'c1', name: 'Home' }), category({ id: 'c2', name: 'Work' })])
    const { user } = renderApp('/categories')

    await user.click(await screen.findByRole('button', { name: en.categories.deleteNamed.replace('{{name}}', 'Home') }))
    expect(calls).toEqual([])
    await user.click(screen.getByRole('button', { name: en.common.confirmDelete }))

    await waitFor(() => expect(screen.queryByText('Home')).not.toBeInTheDocument())
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'DELETE', id: 'c1' }])
  })

  it('renders the page in Russian after switching the language', async () => {
    categoriesBackend([category({ id: 'c1', name: 'Home' })])
    await i18n.changeLanguage('ru')
    renderApp('/categories')

    expect(await screen.findByRole('heading', { name: ru.categories.title })).toBeInTheDocument()
  })
})
