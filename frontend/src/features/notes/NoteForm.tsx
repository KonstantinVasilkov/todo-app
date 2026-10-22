import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { fieldErrors, formError } from '../../api/errors'
import { constraints, noteStatusFilterValues, type NoteCreate } from '../../api/types'
import { Field } from '../../components/Field'
import { clearDraft, loadDraft, saveDraft } from '../../lib/drafts'
import { CategoryPicker } from '../categories/CategoryPicker'
import type { NoteFormValues } from './formValues'

export function NoteForm({
  initial,
  draftKey,
  draftBase,
  submitLabel,
  error,
  pending,
  onSubmit,
  children,
}: {
  initial: NoteFormValues
  draftKey: string
  draftBase: string | null
  submitLabel: string
  error: unknown
  pending: boolean
  onSubmit: (values: NoteFormValues) => void
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const [restored] = useState(() => loadDraft<NoteFormValues>(draftKey, draftBase))
  const [values, setValues] = useState<NoteFormValues>(restored ?? initial)
  const [showRestored, setShowRestored] = useState(restored !== null)
  const edited = useRef(false)

  useEffect(() => {
    if (edited.current) saveDraft(draftKey, draftBase, values)
  }, [draftKey, draftBase, values])

  function set<K extends keyof NoteFormValues>(key: K, value: NoteFormValues[K]) {
    edited.current = true
    setValues((v) => ({ ...v, [key]: value }))
  }

  function discardDraft() {
    clearDraft(draftKey)
    edited.current = false
    setValues(initial)
    setShowRestored(false)
  }

  const errors = fieldErrors<NoteCreate>(error)
  const message = error ? formError(error) : null

  return (
    <form
      className="note-form stack"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(values)
      }}
    >
      {showRestored && (
        <div className="notice">
          <span>{t('editor.draftRestored')}</span>
          <button type="button" className="ghost" onClick={discardDraft}>
            {t('editor.discardDraft')}
          </button>
        </div>
      )}

      <Field label={t('editor.fields.title')} error={errors.title}>
        {(control) => (
          <input
            {...control}
            required
            maxLength={constraints.schemas.NoteCreate.title.maxLength}
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
          />
        )}
      </Field>

      <Field label={t('editor.fields.body')} error={errors.body}>
        {(control) => <textarea {...control} rows={5} value={values.body} onChange={(e) => set('body', e.target.value)} />}
      </Field>

      <div className="row">
        <Field label={t('editor.fields.dueDate')} error={errors.due}>
          {(control) => (
            <input {...control} type="date" value={values.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          )}
        </Field>
        <Field label={t('editor.fields.dueTime')}>
          {(control) => (
            <input
              {...control}
              type="time"
              disabled={!values.dueDate}
              value={values.dueTime}
              onChange={(e) => set('dueTime', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('editor.fields.status')} error={errors.status}>
          {(control) => (
            <select
              {...control}
              value={values.status}
              onChange={(e) => set('status', e.target.value as NoteFormValues['status'])}
            >
              {noteStatusFilterValues.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <CategoryPicker
        value={values.categoryIds}
        onChange={(ids) => set('categoryIds', ids)}
        error={errors.category_ids}
      />

      {message && (
        <p role="alert" className="form-error">
          {message}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {submitLabel}
        </button>
        <Link to="/" className="button ghost">
          {t('common.cancel')}
        </Link>
        <span className="spacer" />
        {children}
      </div>
    </form>
  )
}
