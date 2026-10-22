import { useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useMe } from '../api/queries'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { useSession } from '../context'
import './header.css'

export function AppLayout() {
  const { t } = useTranslation()
  const me = useMe()
  const session = useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  function signOut() {
    session.signOut()
    queryClient.clear()
    void navigate({ to: '/login' })
  }

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="logo" aria-hidden="true">
            ✓
          </span>
          {t('app.name')}
        </Link>
        <nav aria-label={t('nav.sections')} className="sections">
          <Link to="/" activeOptions={{ exact: true, includeSearch: false }}>
            {t('nav.calendar')}
          </Link>
          <Link to="/notes" activeOptions={{ includeSearch: false }}>
            {t('nav.notes')}
          </Link>
          <Link to="/categories">{t('nav.categories')}</Link>
        </nav>
        <div className="account">
          <LanguageSwitcher />
          {me.data && <span className="muted">{me.data.username}</span>}
          <button type="button" className="ghost" onClick={signOut}>
            {t('nav.signOut')}
          </button>
        </div>
        <Link to="/notes/new" className="new-note">
          <span aria-hidden="true">+</span>
          {t('notes.new')}
        </Link>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
