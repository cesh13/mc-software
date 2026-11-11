'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CopyEntryInput, Entry, EntryInput, EntryListItem, EntrySaveResult, NextNumber } from '@accounting/shared'
import { apiFetch, qs } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { GL_API, glKeys } from './use-gl-setup'

const ENTRIES = `${GL_API}/entries`

export function useEntry(id: string | null) {
  const { empresa } = useEmpresa()
  return useQuery<Entry>({
    queryKey: glKeys.entry(empresa.id, id ?? ''),
    queryFn: () => apiFetch(`${ENTRIES}/${id}`),
    enabled: !!id,
  })
}

// The month's entries in screen order (type code, number).
export function useEntryList(period: string, includeVoided = false, enabled = true) {
  const { empresa } = useEmpresa()
  return useQuery<EntryListItem[]>({
    queryKey: glKeys.entries(empresa.id, period, includeVoided),
    queryFn: () => apiFetch(`${ENTRIES}${qs({ period, includeVoided })}`),
    enabled,
  })
}

// Preview only: the server assigns the final number when saving.
export function useNextNumber(period: string, entryTypeId: string, enabled: boolean) {
  const { empresa } = useEmpresa()
  return useQuery<NextNumber>({
    queryKey: glKeys.nextNumber(empresa.id, period, entryTypeId),
    queryFn: () => apiFetch(`${ENTRIES}/next-number${qs({ period, entryTypeId })}`),
    enabled: enabled && !!entryTypeId,
    staleTime: 0,
  })
}

// Each mutation stores the returned entry in the cache and refreshes every 'gl' query.
export function useEntryMutations() {
  const qc = useQueryClient()
  const { empresa } = useEmpresa()
  const done = (entry: Entry) => {
    qc.setQueryData(glKeys.entry(empresa.id, entry.id), entry)
    return qc.invalidateQueries({ queryKey: ['gl'], predicate: (q) => q.queryKey[1] !== 'entry' || q.queryKey[3] !== entry.id })
  }
  const post = <T,>(path: string, json?: unknown) => apiFetch<T>(`${ENTRIES}${path}`, { method: 'POST', json })

  const save = useMutation({
    mutationFn: (v: { id: string | null; input: EntryInput }) =>
      v.id
        ? apiFetch<EntrySaveResult>(`${ENTRIES}/${v.id}`, { method: 'PUT', json: v.input })
        : apiFetch<EntrySaveResult>(ENTRIES, { json: v.input }),
    onSuccess: done,
  })
  const apply = useMutation({ mutationFn: (id: string) => post<Entry>(`/${id}/apply`), onSuccess: done })
  const voidEntry = useMutation({ mutationFn: (id: string) => post<Entry>(`/${id}/void`), onSuccess: done })
  const copy = useMutation({
    mutationFn: (v: { id: string; input: CopyEntryInput }) => post<EntrySaveResult>(`/${v.id}/copy`, v.input),
    onSuccess: done,
  })
  return { save, apply, voidEntry, copy }
}
