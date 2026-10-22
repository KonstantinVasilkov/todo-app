import { Link } from '@tanstack/react-router'
import { useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useCategories } from '../../api/queries'

export function CategoryPicker({
  value,
  onChange,
  error,
}: {
  value: string[]
  onChange: (ids: string[]) => void
  error?: string
}) {
  const { t } = useTranslation()
  const categories = useCategories()
  const errorId = useId()

  useEffect(() => {
    if (!categories.data) return
    const known = value.filter((id) => categories.data.some((c) => c.id === id))
    if (known.length !== value.length) onChange(known)
  }, [categories.data, value, onChange])

  return (
    <fieldset className="category-picker" aria-describedby={error ? errorId : undefined}>
      <legend>{t('editor.fields.categories')}</legend>
      {categories.data && categories.data.length > 0 ? (
        categories.data.map((c) => (
          <label key={c.id} className="check">
            <input
              type="checkbox"
              checked={value.includes(c.id)}
              onChange={() => onChange(value.includes(c.id) ? value.filter((id) => id !== c.id) : [...value, c.id])}
            />
            {c.name}
          </label>
        ))
      ) : (
        <p className="muted">
          {t('editor.noCategories')} <Link to="/categories">{t('editor.createCategory')}</Link>
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  )
}
