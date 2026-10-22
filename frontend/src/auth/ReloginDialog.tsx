import { useQueryClient } from '@tanstack/react-query'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { keys } from '../api/queries'
import type { UserRead } from '../api/types'
import { useSession, useSessionState } from '../context'
import { LoginForm } from './LoginForm'

export function ReloginDialog() {
  const { t } = useTranslation()
  const { expired } = useSessionState()
  const session = useSession()
  const queryClient = useQueryClient()
  const titleId = useId()

  if (!expired) return null

  const lastUsername = queryClient.getQueryData<UserRead>(keys.me)?.username

  return (
    <div className="overlay">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="card dialog">
        <h2 id={titleId}>{t('auth.relogin.title')}</h2>
        <p className="muted">{t('auth.relogin.hint')}</p>
        <LoginForm
          initialUsername={lastUsername}
          onSuccess={(token) => {
            session.signIn(token)
            void queryClient.invalidateQueries()
          }}
        />
      </div>
    </div>
  )
}
