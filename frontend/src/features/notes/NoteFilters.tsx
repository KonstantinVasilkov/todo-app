import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCategories } from '../../api/queries'
import { noteStatusFilterValues } from '../../api/types'
import type { DueFilter, NotesSearch } from './filters'

const VIEWS: { due?: DueFilter }[] = [{}, { due: 'today' }, { due: 'overdue' }, { due: 'none' }]

function toggle<T>(list: T[] | undefined, value: T): T[] | undefined {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value]
  return next.length ? next : undefined
}

export function NoteFilters({ search }: { search: NotesSearch }) {
  const { t } = useTranslation()
  const navigate = useNavigate({ from: '/notes' })
  const categories = useCategories()
  const update = (patch: Partial<NotesSearch>) => void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  const filtered = Object.keys(search).length > 0
  const [open, setOpen] = useState(false)
  const applied = (search.status?.length ?? 0) + (search.category?.length ?? 0) + (search.from ? 1 : 0) + (search.to ? 1 : 0)

  return (
    <aside className={open ? 'filters open' : 'filters'}>
      <nav aria-label={t('filters.views')}>
        <ul className="views">
          {VIEWS.map((view) => (
            <li key={view.due ?? 'all'}>
              <Link
                to="/notes"
                search={(prev) => ({ ...prev, due: view.due, from: undefined, to: undefined })}
                activeOptions={{ exact: true }}
              >
                {t(`filters.view.${view.due ?? 'all'}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <button type="button" className="ghost filters-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {applied ? t('filters.toggleApplied', { applied }) : t('filters.toggle')}
      </button>

      <div className="filters-body">
        <fieldset>
          <legend>{t('filters.status')}</legend>
          {noteStatusFilterValues.map((status) => (
            <label key={status} className="check">
              <input
                type="checkbox"
                checked={search.status?.includes(status) ?? false}
                onChange={() => update({ status: toggle(search.status, status) })}
              />
              {t(`status.${status}`)}
            </label>
          ))}
        </fieldset>

        {categories.data && categories.data.length > 0 && (
          <fieldset>
            <legend>{t('filters.categories')}</legend>
            {categories.data.map((c) => (
              <label key={c.id} className="check">
                <input
                  type="checkbox"
                  checked={search.category?.includes(c.id) ?? false}
                  onChange={() => update({ category: toggle(search.category, c.id) })}
                />
                {c.name}
              </label>
            ))}
          </fieldset>
        )}

        {!search.due && (
          <fieldset className="range">
            <legend>{t('filters.due')}</legend>
            <label>
              {t('filters.from')}
              <input type="date" value={search.from ?? ''} onChange={(e) => update({ from: e.target.value || undefined })} />
            </label>
            <label>
              {t('filters.to')}
              <input type="date" value={search.to ?? ''} onChange={(e) => update({ to: e.target.value || undefined })} />
            </label>
          </fieldset>
        )}

        {filtered && (
          <Link to="/notes" search={{}} className="reset">
            {t('filters.reset')}
          </Link>
        )}
      </div>
    </aside>
  )
}
