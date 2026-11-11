'use client'

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CostCenter, CostCenterInput, CostCenterUpdate, EntryType, EntryTypeInput, EntryTypeUpdate, PeriodStatusRow,
} from '@accounting/shared'
import { apiFetch, qs } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'

export const GL_API = '/api/general-ledger'

// Every key starts with ['gl'] and carries the empresa id, so a prefix invalidation refreshes
// the entry screen and any general-ledger report at once.
export const glKeys = {
  entryTypes: (empresaId: string, inactive: boolean) => ['gl', 'entry-types', empresaId, inactive] as const,
  costCenters: (empresaId: string, inactive: boolean) => ['gl', 'cost-centers', empresaId, inactive] as const,
  periods: (empresaId: string, year: string) => ['gl', 'periods', empresaId, year] as const,
  entries: (empresaId: string, period: string, voided: boolean) => ['gl', 'entries', empresaId, period, voided] as const,
  entry: (empresaId: string, id: string) => ['gl', 'entry', empresaId, id] as const,
  nextNumber: (empresaId: string, period: string, typeId: string) => ['gl', 'next-number', empresaId, period, typeId] as const,
}

export function useEntryTypes(includeInactive = false) {
  const { empresa } = useEmpresa()
  return useQuery<EntryType[]>({
    queryKey: glKeys.entryTypes(empresa.id, includeInactive),
    queryFn: () => apiFetch(`${GL_API}/entry-types${qs({ includeInactive })}`),
    staleTime: 60_000,
  })
}

export function useCostCenters(includeInactive = false) {
  const { empresa } = useEmpresa()
  return useQuery<CostCenter[]>({
    queryKey: glKeys.costCenters(empresa.id, includeInactive),
    queryFn: () => apiFetch(`${GL_API}/cost-centers${qs({ includeInactive })}`),
    staleTime: 60_000,
  })
}

// Month statuses of the period's calendar year; `closed` holds the closed 'AAAA-MM' values.
export function usePeriodStatus(period: string) {
  const { empresa } = useEmpresa()
  const year = period.slice(0, 4)
  const query = useQuery<PeriodStatusRow[]>({
    queryKey: glKeys.periods(empresa.id, year),
    queryFn: () => apiFetch(`${GL_API}/periods${qs({ year })}`),
  })
  const closed = useMemo(
    () => new Set((query.data ?? []).filter((p) => p.status === 'closed').map((p) => p.period)),
    [query.data],
  )
  return { ...query, closed, isClosed: closed.has(period) }
}

export function useSetupMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['gl'] })

  const saveType = useMutation({
    mutationFn: (v: { id?: string; input: EntryTypeInput | EntryTypeUpdate }) =>
      v.id
        ? apiFetch<EntryType>(`${GL_API}/entry-types/${v.id}`, { method: 'PATCH', json: v.input })
        : apiFetch<EntryType>(`${GL_API}/entry-types`, { json: v.input }),
    onSuccess: refresh,
  })
  const setTypeActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      v.active
        ? apiFetch<EntryType>(`${GL_API}/entry-types/${v.id}`, { method: 'PATCH', json: { isActive: true } })
        : apiFetch<EntryType>(`${GL_API}/entry-types/${v.id}/deactivate`, { method: 'POST' }),
    onSuccess: refresh,
  })
  const saveCenter = useMutation({
    mutationFn: (v: { id?: string; input: CostCenterInput | CostCenterUpdate }) =>
      v.id
        ? apiFetch<CostCenter>(`${GL_API}/cost-centers/${v.id}`, { method: 'PATCH', json: v.input })
        : apiFetch<CostCenter>(`${GL_API}/cost-centers`, { json: v.input }),
    onSuccess: refresh,
  })
  const setCenterActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      v.active
        ? apiFetch<CostCenter>(`${GL_API}/cost-centers/${v.id}`, { method: 'PATCH', json: { isActive: true } })
        : apiFetch<CostCenter>(`${GL_API}/cost-centers/${v.id}/deactivate`, { method: 'POST' }),
    onSuccess: refresh,
  })
  return { saveType, setTypeActive, saveCenter, setCenterActive }
}
