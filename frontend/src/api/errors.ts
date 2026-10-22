import i18n from '../i18n'
import en from '../i18n/locales/en.json'
import { domainErrorTypeValues, type DomainErrorType, type ErrorItem } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(status: number, detail: unknown) {
    super(`API ${status}`)
    this.status = status
    this.detail = detail
  }
}

type TranslatedValidationType = keyof typeof en.errors.validation

function isDomainType(type: string): type is DomainErrorType {
  return (domainErrorTypeValues as readonly string[]).includes(type)
}

function isTranslatedValidationType(type: string): type is TranslatedValidationType {
  return Object.hasOwn(en.errors.validation, type)
}

function messageOf(item: ErrorItem, field: string | null): string {
  if (isDomainType(item.type)) {
    const specific = `errors.${item.type}.${field}`
    return field && i18n.exists(specific)
      ? i18n.t(specific as `errors.${DomainErrorType}.default`)
      : i18n.t(`errors.${item.type}.default`)
  }
  return isTranslatedValidationType(item.type) ? i18n.t(`errors.validation.${item.type}`) : item.msg
}

function errorItems(error: unknown): ErrorItem[] {
  return error instanceof ApiError && Array.isArray(error.detail) ? (error.detail as ErrorItem[]) : []
}

function bodyField(item: ErrorItem): string | null {
  const [where, field, ...rest] = item.loc
  return where === 'body' && typeof field === 'string' && rest.length === 0 ? field : null
}

export function fieldErrors<Body extends object>(error: unknown): Partial<Record<Extract<keyof Body, string>, string>> {
  const result: Record<string, string> = {}
  for (const item of errorItems(error)) {
    const field = bodyField(item)
    if (field && !(field in result)) result[field] = messageOf(item, field)
  }
  return result
}

export function formError(error: unknown): string | null {
  if (!(error instanceof ApiError)) return i18n.t('errors.network')
  if (error.status === 401) return i18n.t('errors.sessionExpired')
  if (error.status >= 500) return i18n.t('errors.server')
  if (error.status === 404) return i18n.t('errors.notFound')
  if (typeof error.detail === 'string') return error.detail
  if (Array.isArray(error.detail)) {
    const rest = errorItems(error).filter((item) => bodyField(item) === null)
    return rest.length ? rest.map((item) => messageOf(item, null)).join('; ') : null
  }
  return i18n.t('errors.unknown')
}
