import { useTranslation } from 'react-i18next'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { formError } from '../../api/errors'
import { useCreateNote, useDeleteNote, useNote, useUpdateNote } from '../../api/queries'
import type { NoteRead } from '../../api/types'
import { ConfirmButton } from '../../components/ConfirmButton'
import { clearDraft } from '../../lib/drafts'
import { NoteForm } from './NoteForm'
import { emptyNoteForm, formFromNote, toNoteCreate, toNoteUpdate } from './formValues'

const noteRoute = getRouteApi('/_app/notes/$noteId')

export function NewNotePage() {
  const { t } = useTranslation()
  const create = useCreateNote()
  const navigate = useNavigate()
  const draftKey = 'note:new'

  return (
    <section className="editor">
      <h1>{t('editor.newTitle')}</h1>
      <NoteForm
        initial={emptyNoteForm}
        draftKey={draftKey}
        draftBase={null}
        submitLabel={t('editor.create')}
        error={create.error}
        pending={create.isPending}
        onSubmit={(values) =>
          create.mutate(toNoteCreate(values), {
            onSuccess: () => {
              clearDraft(draftKey)
              void navigate({ to: '/' })
            },
          })
        }
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
        <Link to="/">{t('common.backToList')}</Link>
      </section>
    )
  }
  return <EditNote key={note.data.id} note={note.data} />
}

function EditNote({ note }: { note: NoteRead }) {
  const { t } = useTranslation()
  const update = useUpdateNote(note.id)
  const remove = useDeleteNote()
  const navigate = useNavigate()
  const draftKey = `note:${note.id}`

  function done() {
    clearDraft(draftKey)
    void navigate({ to: '/' })
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
