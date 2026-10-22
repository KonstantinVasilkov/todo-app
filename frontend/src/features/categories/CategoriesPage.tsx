import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fieldErrors, formError } from '../../api/errors'
import { useCategories, useCreateCategory, useDeleteCategory, useRenameCategory } from '../../api/queries'
import { constraints, type CategoryCreate, type CategoryRead, type CategoryUpdate } from '../../api/types'
import { ConfirmButton } from '../../components/ConfirmButton'
import { Field } from '../../components/Field'

export function CategoriesPage() {
  const { t } = useTranslation()
  const categories = useCategories()
  const create = useCreateCategory()
  const [name, setName] = useState('')
  const message = create.isError ? formError(create.error) : null

  return (
    <section className="categories">
      <h1>{t('categories.title')}</h1>
      <p className="muted">{t('categories.hint')}</p>

      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate(name.trim(), {
            onSuccess: () => {
              setName('')
              create.reset()
            },
          })
        }}
      >
        <Field label={t('categories.new')} error={fieldErrors<CategoryCreate>(create.error).name}>
          {(control) => (
            <input
              {...control}
              required
              maxLength={constraints.schemas.CategoryCreate.name.maxLength}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <button type="submit" className="primary" disabled={create.isPending}>
          {t('categories.add')}
        </button>
      </form>
      {message && (
        <p role="alert" className="form-error">
          {message}
        </p>
      )}

      {categories.isError ? (
        <p role="alert" className="form-error">
          {formError(categories.error)}
        </p>
      ) : (
        <ul aria-label={t('categories.list')} className="category-list">
          {categories.data?.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
      )}
    </section>
  )
}

function CategoryRow({ category }: { category: CategoryRead }) {
  const { t } = useTranslation()
  const rename = useRenameCategory()
  const remove = useDeleteCategory()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)

  if (editing) {
    return (
      <li className="category-row">
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault()
            rename.mutate({ id: category.id, name: name.trim() }, { onSuccess: () => setEditing(false) })
          }}
        >
          <Field label={t('categories.name')} error={fieldErrors<CategoryUpdate>(rename.error).name}>
            {(control) => (
              <input
                {...control}
                autoFocus
                required
                maxLength={constraints.schemas.CategoryUpdate.name.maxLength}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          <button type="submit" className="primary" disabled={rename.isPending}>
            {t('common.save')}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setEditing(false)
              setName(category.name)
              rename.reset()
            }}
          >
            {t('common.cancel')}
          </button>
        </form>
      </li>
    )
  }

  return (
    <li className="category-row">
      <span className="category-name">{category.name}</span>
      <button type="button" className="ghost" aria-label={t('categories.renameNamed', { name: category.name })} onClick={() => setEditing(true)}>
        {t('categories.rename')}
      </button>
      <ConfirmButton label={t('categories.deleteNamed', { name: category.name })} disabled={remove.isPending} onConfirm={() => remove.mutate(category.id)}>
        {t('common.delete')}
      </ConfirmButton>
    </li>
  )
}
