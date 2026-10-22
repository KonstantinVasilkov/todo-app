import { getRouteApi, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { formError } from '../../api/errors'
import { useNoteList, useSetNoteStatus } from '../../api/queries'
import { useNow } from '../../lib/useNow'
import { NoteFilters } from './NoteFilters'
import { NoteItem } from './NoteItem'

const route = getRouteApi('/_app/notes')

export function NotesPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const list = useNoteList(search)
  const setStatus = useSetNoteStatus()
  const now = useNow()

  const notes = list.data?.pages.flatMap((p) => p.items) ?? []
  const total = list.data?.pages.at(-1)?.total ?? 0

  return (
    <div className="notes-page">
      <NoteFilters search={search} />
      <section className="notes-main">
        <header className="page-header">
          <h1>{t(`notes.title.${search.due ?? 'all'}`)}</h1>
          <Link to="/notes/new" className="button primary">
            {t('notes.new')}
          </Link>
        </header>

        {setStatus.isError && (
          <p role="alert" className="form-error">
            {formError(setStatus.error)}
          </p>
        )}

        {list.isPending ? (
          <p className="muted">{t('common.loading')}</p>
        ) : list.isError ? (
          <p role="alert" className="form-error">
            {formError(list.error)}
          </p>
        ) : notes.length === 0 ? (
          <p className="empty">{t('notes.empty')}</p>
        ) : (
          <>
            <ul className="note-list">
              {notes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  now={now}
                  onStatusChange={(status) => setStatus.mutate({ id: note.id, status })}
                />
              ))}
            </ul>
            <footer className="list-footer">
              <span className="muted">
                {t('notes.shown', { shown: notes.length, total })}
              </span>
              {list.hasNextPage && (
                <button type="button" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                  {t('notes.loadMore')}
                </button>
              )}
            </footer>
          </>
        )}
      </section>
    </div>
  )
}
