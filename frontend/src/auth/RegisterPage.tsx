import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fieldErrors, formError } from '../api/errors'
import { constraints, type RegisterRequest } from '../api/types'
import { Field } from '../components/Field'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { useApi, useSession } from '../context'

export function RegisterPage() {
  const { t } = useTranslation()
  const api = useApi()
  const session = useSession()
  const navigate = useNavigate()
  const [values, setValues] = useState<RegisterRequest>({ username: '', email: '', password: '' })
  const register = useMutation({
    mutationFn: async (body: RegisterRequest) => {
      await api.register(body)
      return api.login(body.username, body.password)
    },
    onSuccess: (token) => {
      session.signIn(token.access_token)
      void navigate({ to: '/' })
    },
  })

  const errors = fieldErrors<RegisterRequest>(register.error)
  const message = formError(register.error)
  const set = (key: keyof RegisterRequest) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  return (
    <main className="auth-page">
      <div className="card">
        <LanguageSwitcher />
        <h1>{t('auth.register.title')}</h1>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault()
            register.mutate(values)
          }}
        >
          <Field label={t('auth.username')} error={errors.username}>
            {(control) => (
              <input
                {...control}
                name="username"
                autoComplete="username"
                required
                value={values.username}
                onChange={set('username')}
              />
            )}
          </Field>
          <Field label={t('auth.email')} error={errors.email}>
            {(control) => (
              <input {...control} name="email" type="email" autoComplete="email" required value={values.email} onChange={set('email')} />
            )}
          </Field>
          <Field label={t('auth.password')} error={errors.password}>
            {(control) => (
              <input
                {...control}
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={constraints.schemas.RegisterRequest.password.minLength}
                value={values.password}
                onChange={set('password')}
              />
            )}
          </Field>
          {register.isError && message && (
            <p role="alert" className="form-error">
              {message}
            </p>
          )}
          <button type="submit" className="primary" disabled={register.isPending}>
            {t('auth.register.submit')}
          </button>
        </form>
        <p className="muted">
          {t('auth.register.haveAccount')} <Link to="/login">{t('auth.register.toLogin')}</Link>
        </p>
      </div>
    </main>
  )
}
