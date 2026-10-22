import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTranslation } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import ru from './locales/ru.json'
import { LanguageSwitcher } from './LanguageSwitcher'
import { LANGUAGE_STORAGE_KEY } from '.'

function Probe() {
  const { t } = useTranslation()
  return <h1>{t('notes.title.all')}</h1>
}

describe('LanguageSwitcher', () => {
  it('starts in English and offers every supported language', () => {
    render(
      <>
        <LanguageSwitcher />
        <Probe />
      </>,
    )

    const select = screen.getByRole('combobox', { name: en.language.label })
    expect(select).toHaveValue('en')
    expect([...select.querySelectorAll('option')].map((o) => o.value)).toEqual(['en', 'ru'])
    expect(screen.getByRole('heading')).toHaveTextContent(en.notes.title.all)
    expect(document.documentElement.lang).toBe('en')
  })

  it('switches the interface to Russian, updates <html lang> and remembers the choice', async () => {
    const user = userEvent.setup()
    render(
      <>
        <LanguageSwitcher />
        <Probe />
      </>,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: en.language.label }), 'ru')

    expect(screen.getByRole('heading')).toHaveTextContent(ru.notes.title.all)
    expect(screen.getByRole('combobox', { name: ru.language.label })).toHaveValue('ru')
    expect(document.documentElement.lang).toBe('ru')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ru')
  })
})
