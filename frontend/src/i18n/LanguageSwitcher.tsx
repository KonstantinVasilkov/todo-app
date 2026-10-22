import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage, type Language } from '.'

function nativeName(language: Language): string {
  try {
    const name = new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language
    return name.charAt(0).toLocaleUpperCase(language) + name.slice(1)
  } catch {
    return language.toUpperCase()
  }
}

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  return (
    <select
      className="language-switcher"
      aria-label={t('language.label')}
      value={i18n.resolvedLanguage}
      onChange={(event) => void setLanguage(event.target.value as Language)}
    >
      {LANGUAGES.map((language) => (
        <option key={language} value={language} lang={language}>
          {nativeName(language)}
        </option>
      ))}
    </select>
  )
}
