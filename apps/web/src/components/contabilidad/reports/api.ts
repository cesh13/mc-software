'use client'

import { useQuery } from '@tanstack/react-query'
import type { CostCenter, EntryType, FiscalYear, Period } from '@accounting/shared'
import { apiFetch, qs } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'

export const GL_API = '/api/general-ledger'

// Query keys: every one carries the empresa id. 'gl-report' and 'gl-periods' are the prefixes to invalidate.
export const reportKeys = {
  report: ['gl-report'] as const,
  periods: ['gl-periods'] as const,
}

type Params = Record<string, string | number | boolean | null | undefined>

// One report request, GET `${GL_API}/reports/<path>?params`. Disabled until `enabled`.
export function useReport<T>(path: string, params: Params, enabled = true) {
  const { empresa } = useEmpresa()
  return useQuery<T>({
    queryKey: [...reportKeys.report, empresa.id, path, params],
    queryFn: () => apiFetch<T>(`${GL_API}/${path}${qs(params)}`),
    enabled,
  })
}

// Active cost centers.
export function useCostCenters() {
  const { empresa } = useEmpresa()
  return useQuery<CostCenter[]>({
    queryKey: ['reports', 'cost-centers', empresa.id],
    queryFn: () => apiFetch(`${GL_API}/cost-centers`),
    staleTime: 60_000,
  })
}

// Active entry types.
export function useEntryTypes() {
  const { empresa } = useEmpresa()
  return useQuery<EntryType[]>({
    queryKey: ['reports', 'entry-types', empresa.id],
    queryFn: () => apiFetch(`${GL_API}/entry-types`),
    staleTime: 60_000,
  })
}

// Fiscal year that contains `period`.
export function useFiscalYearOf(period: Period) {
  const { empresa } = useEmpresa()
  return useQuery<FiscalYear>({
    queryKey: ['reports', 'fiscal-year', empresa.id, period],
    queryFn: () => apiFetch(`${GL_API}/fiscal-years/for-period${qs({ period })}`),
    staleTime: 60_000,
  })
}
