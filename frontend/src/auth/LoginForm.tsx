import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, fieldErrors, formError } from '../api/errors'
import type { LoginForm as LoginFields } from '../api/types'
import { Field } from '../components/Field'
import { useApi } from '../context'

export function LoginForm({ initialUsername = '', onSuccess }: { initialUsername?: string; onSuccess: (token: string) => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const [username, setUsername] = useState(initialUsername)
  const [password, setPassword] = useState('')
  const login = useMutation({
    mutationFn: () => api.login(username, password),
    onSuccess: (token) => onSuccess(token.access_token),
  })

  const errors = fieldErrors<LoginFields>(login.error)
  const message =
    login.error instanceof ApiError && login.error.status === 401 ? t('auth.login.wrongCredentials') : formError(login.error)

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault()
        login.mutate()
      }}
    >
      <Field label={t('auth.username')} error={errors.username}>
        {(control) => (
          <input
            {...control}
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}
      </Field>
      <Field label={t('auth.password')} error={errors.password}>
        {(control) => (
          <input
            {...control}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      {login.isError && message && (
        <p role="alert" className="form-error">
          {message}
        </p>
      )}
      <button type="submit" className="primary" disabled={login.isPending}>
        {t('auth.login.submit')}
      </button>
    </form>
  )
}
