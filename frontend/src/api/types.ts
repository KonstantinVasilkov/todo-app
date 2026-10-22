import type { components, operations } from './schema'

export type { paths } from './schema'

export { constraints, domainErrorTypeValues, noteStatusFilterValues, noteStatusValues } from './schema'

type Schemas = components['schemas']

export type NoteStatus = Schemas['NoteStatus']

export type StatusFilter = Schemas['NoteStatusFilter']

export type UserRead = Schemas['UserRead']
export type RegisterRequest = Schemas['RegisterRequest']
export type LoginForm = Schemas['Body_login_auth_login_post']
export type Token = Schemas['Token']

export type CategoryRead = Schemas['CategoryRead']
export type CategoryCreate = Schemas['CategoryCreate']
export type CategoryUpdate = Schemas['CategoryUpdate']

export type NoteRead = Schemas['NoteRead']

export type NoteCreate = Schemas['NoteCreate']

export type NoteUpdate = Schemas['NoteUpdate']
export type NotePage = Schemas['Page_NoteRead_']

export type ListNotesParams = NonNullable<operations['list_notes_notes_get']['parameters']['query']>

export type ErrorResponse = Schemas['ErrorResponse']

export type DomainErrorType = Schemas['DomainErrorType']
export type ErrorItem = Schemas['DomainErrorItem'] | Schemas['ValidationErrorItem']
