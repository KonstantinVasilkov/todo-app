import { describe, expect, it } from 'vitest'
import i18n from '../i18n'
import en from '../i18n/locales/en.json'
import ru from '../i18n/locales/ru.json'
import { ApiError, fieldErrors, formError } from './errors'

describe('fieldErrors', () => {
  it('maps body locations to form fields', () => {
    const err = new ApiError(422, [
      { loc: ['body', 'title'], msg: 'String should have at least 1 character', type: 'string_too_short' },
      { loc: ['body', 'due'], msg: 'Input should be a valid datetime', type: 'datetime_parsing' },
    ])

    expect(fieldErrors(err)).toEqual({
      title: en.errors.validation.string_too_short,
      due: 'Input should be a valid datetime',
    })
  })

  it('translates a conflict by the field it names', () => {
    const err = new ApiError(409, [{ loc: ['body', 'email'], msg: 'Email already registered', type: 'conflict' }])

    expect(fieldErrors(err)).toEqual({ email: en.errors.conflict.email })
  })

  it('falls back to the generic text of a domain error for other fields', () => {
    const err = new ApiError(409, [{ loc: ['body', 'nickname'], msg: 'taken', type: 'conflict' }])

    expect(fieldErrors(err)).toEqual({ nickname: en.errors.conflict.default })
  })

  it('explains a reference to a category that no longer exists', () => {
    const err = new ApiError(422, [
      { loc: ['body', 'category_ids'], msg: 'Unknown category ids: c9', type: 'invalid_reference' },
    ])

    expect(fieldErrors(err)).toEqual({ category_ids: en.errors.invalid_reference.category_ids })
  })

  it('explains a value the server rejected by its pattern', () => {
    const err = new ApiError(422, [
      { loc: ['body', 'username'], msg: "String should match pattern '^[A-Za-z0-9_.-]{3,50}$'", type: 'string_pattern_mismatch' },
    ])

    expect(fieldErrors(err)).toEqual({ username: en.errors.validation.string_pattern_mismatch })
  })

  it('keeps the first message when a field has several', () => {
    const err = new ApiError(422, [
      { loc: ['body', 'username'], msg: 'Field required', type: 'missing' },
      { loc: ['body', 'username'], msg: 'second', type: 'value_error' },
    ])

    expect(fieldErrors(err)).toEqual({ username: en.errors.validation.missing })
  })

  it('follows the current language', async () => {
    const err = new ApiError(409, [{ loc: ['body', 'name'], msg: 'taken', type: 'conflict' }])

    await i18n.changeLanguage('ru')

    expect(fieldErrors(err)).toEqual({ name: ru.errors.conflict.name })
  })

  it('ignores errors that do not point at a body field', () => {
    const err = new ApiError(422, [{ loc: ['query', 'limit'], msg: 'too big', type: 'less_than_equal' }])

    expect(fieldErrors(err)).toEqual({})
  })

  it('returns nothing for errors without a detail list', () => {
    expect(fieldErrors(new ApiError(404, 'Not Found'))).toEqual({})
    expect(fieldErrors(new TypeError('Failed to fetch'))).toEqual({})
  })
})

describe('formError', () => {
  it('returns null when every problem belongs to a field', () => {
    const err = new ApiError(422, [{ loc: ['body', 'title'], msg: 'x', type: 'missing' }])

    expect(formError(err)).toBeNull()
  })

  it('surfaces errors that no field can show', () => {
    const err = new ApiError(422, [
      { loc: ['body', 'category_ids', 0], msg: 'Input should be a valid UUID', type: 'uuid_parsing' },
    ])

    expect(formError(err)).toBe('Input should be a valid UUID')
  })

  it('explains a 401 as an ended session, not a server message', () => {
    expect(formError(new ApiError(401, 'Not authenticated'))).toBe(en.errors.sessionExpired)
  })

  it('distinguishes network, server and not-found failures', () => {
    expect(formError(new TypeError('Failed to fetch'))).toBe(en.errors.network)
    expect(formError(new ApiError(500, 'Internal Server Error'))).toBe(en.errors.server)
    expect(formError(new ApiError(404, 'Not Found'))).toBe(en.errors.notFound)
  })
})
