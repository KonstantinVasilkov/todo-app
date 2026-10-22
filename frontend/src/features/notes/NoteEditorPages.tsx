import { useTranslation } from 'react-i18next'
import { getRouteApi, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { formError } from '../../api/errors'
import { useCreateNote, useDeleteNote, useNote, useUpdateNote } from '../../api/queries'
import type { NoteRead } from '../../api/types'
import { ConfirmButton } from '../../components/ConfirmButton'
import { clearDraft } from '../../lib/drafts'
import { NoteForm } from './NoteForm'
import { emptyNoteForm, formFromNote, toNoteCreate, toNoteUpdate } from './formValues'

const noteRoute = getRouteApi('/_app/notes/$noteId')
const newNoteRoute = getRouteApi('/_app/notes/new')

function useLeaveEditor() {
  const router = useRouter()
  const navigate = useNavigate()
  return () => {
    if (router.history.canGoBack()) router.history.back()
    else void navigate({ to: '/' })
  }
}

export function NewNotePage() {
  const { t } = useTranslation()
  const create = useCreateNote()
  const { date } = newNoteRoute.useSearch()
  const leave = useLeaveEditor()
  const draftKey = date ? `note:new:${date}` : 'note:new'
  const initial = date ? { ...emptyNoteForm, dueDate: date, dueTime: '09:00' } : emptyNoteForm

  return (
    <section className="editor">
      <h1>{t('editor.newTitle')}</h1>
      <NoteForm
        initial={initial}
        draftKey={draftKey}
        draftBase={null}
        submitLabel={t('editor.create')}
        error={create.error}
        pending={create.isPending}
        onSubmit={(values) =>
          create.mutate(toNoteCreate(values), {
            onSuccess: () => {
              clearDraft(draftKey)
              leave()
            },
          })
        }
        onCancel={leave}
      />
    </section>
  )
}

export function EditNotePage() {
  const { t } = useTranslation()
  const { noteId } = noteRoute.useParams()
  const note = useNote(noteId)

  if (note.isPending) return <p className="muted">{t('common.loading')}</p>
  if (note.isError) {
    return (
      <section className="editor">
        <p role="alert" className="form-error">
          {formError(note.error)}
        </p>
        <Link to="/notes">{t('common.backToList')}</Link>
      </section>
    )
  }
  return <EditNote key={note.data.id} note={note.data} />
}

function EditNote({ note }: { note: NoteRead }) {
  const { t } = useTranslation()
  const update = useUpdateNote(note.id)
  const remove = useDeleteNote()
  const leave = useLeaveEditor()
  const draftKey = `note:${note.id}`

  function done() {
    clearDraft(draftKey)
    leave()
  }

  return (
    <section className="editor">
      <h1>{t('editor.editTitle')}</h1>
      <NoteForm
        initial={formFromNote(note)}
        draftKey={draftKey}
        draftBase={note.updated_at}
        submitLabel={t('common.save')}
        error={update.error ?? remove.error}
        pending={update.isPending}
        onCancel={leave}
        onSubmit={(values) => {
          const patch = toNoteUpdate(note, values)
          if (Object.keys(patch).length === 0) return done()
          update.mutate(patch, { onSuccess: done })
        }}
      >
        <ConfirmButton disabled={remove.isPending} onConfirm={() => remove.mutate(note.id, { onSuccess: done })}>
          {t('common.delete')}
        </ConfirmButton>
      </NoteForm>
    </section>
  )
}
