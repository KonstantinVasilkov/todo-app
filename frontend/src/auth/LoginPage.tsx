import { getRouteApi, Link, useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { useSession } from '../context'
import { LoginForm } from './LoginForm'

const route = getRouteApi('/login')

function safeRedirect(target: string | undefined): string {
  return target?.startsWith('/') && !target.startsWith('//') ? target : '/'
}

export function LoginPage() {
  const { t } = useTranslation()
  const { redirect } = route.useSearch()
  const session = useSession()
  const router = useRouter()

  return (
    <main className="auth-page">
      <div className="card">
        <LanguageSwitcher />
        <h1>{t('auth.login.title')}</h1>
        <LoginForm
          onSuccess={(token) => {
            session.signIn(token)
            router.history.push(safeRedirect(redirect))
          }}
        />
        <p className="muted">
          {t('auth.login.noAccount')} <Link to="/register">{t('auth.login.toRegister')}</Link>
        </p>
      </div>
    </main>
  )
}
