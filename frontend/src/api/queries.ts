import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { useApi } from '../context'
import { fieldErrors } from './errors'
import { toListParams, type NotesSearch } from '../features/notes/filters'
import { constraints, type CategoryRead, type NoteCreate, type NotePage, type NoteRead, type NoteStatus, type NoteUpdate } from './types'

export const PAGE_SIZE = constraints.parameters['GET /notes'].limit.default

export const keys = {
  me: ['me'] as const,
  categories: ['categories'] as const,
  notes: ['notes'] as const,
  noteLists: ['notes', 'list'] as const,
  noteList: (search: NotesSearch) => ['notes', 'list', search] as const,
  note: (id: string) => ['notes', 'detail', id] as const,
}

export function useMe() {
  const api = useApi()
  return useQuery({ queryKey: keys.me, queryFn: api.me })
}

export function useCategories() {
  const api = useApi()
  return useQuery({ queryKey: keys.categories, queryFn: api.listCategories })
}

export function useNoteList(search: NotesSearch) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: keys.noteList(search),
    queryFn: ({ pageParam }) =>
      api.listNotes({ ...toListParams(search, new Date()), limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last: NotePage) => {
      const next = last.offset + last.items.length
      return next < last.total ? next : undefined
    },
    placeholderData: keepPreviousData,
  })
}

export function useNote(id: string) {
  const api = useApi()
  return useQuery({ queryKey: keys.note(id), queryFn: () => api.getNote(id) })
}

function refreshStaleCategories(queryClient: QueryClient, error: unknown) {
  if (fieldErrors<NoteCreate>(error).category_ids !== undefined) void queryClient.invalidateQueries({ queryKey: keys.categories })
}

export function useCreateNote() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: NoteCreate) => api.createNote(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.noteLists }),
    onError: (error) => refreshStaleCategories(queryClient, error),
  })
}

export function useUpdateNote(id: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: NoteUpdate) => api.updateNote(id, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.note(id), updated)
      void queryClient.invalidateQueries({ queryKey: keys.noteLists })
    },
    onError: (error) => refreshStaleCategories(queryClient, error),
  })
}

type NoteLists = InfiniteData<NotePage>

export function useSetNoteStatus() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: NoteStatus | null }) => api.updateNote(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: keys.notes })
      const snapshot = queryClient.getQueriesData({ queryKey: keys.notes })
      queryClient.setQueriesData<NoteLists>({ queryKey: keys.noteLists }, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((p) => ({ ...p, items: p.items.map((n) => (n.id === id ? { ...n, status } : n)) })),
            }
          : data,
      )
      queryClient.setQueryData<NoteRead>(keys.note(id), (n) => (n ? { ...n, status } : n))
      return { snapshot }
    },
    onError: (_error, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.notes }),
  })
}

export function useDeleteNote() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.noteLists }),
  })
}

export function useCreateCategory() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.createCategory(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.categories }),
  })
}

export function useRenameCategory() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameCategory(id, name),
    onSuccess: (renamed) => {
      queryClient.setQueryData<CategoryRead[]>(keys.categories, (list) =>
        list?.map((c) => (c.id === renamed.id ? renamed : c)),
      )
      void queryClient.invalidateQueries({ queryKey: keys.categories })
      void queryClient.invalidateQueries({ queryKey: keys.notes })
    },
  })
}

export function useDeleteCategory() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.categories })
      void queryClient.invalidateQueries({ queryKey: keys.notes })
    },
  })
}
