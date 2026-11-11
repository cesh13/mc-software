'use client'

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Account, AccountInput, AccountUpdate, BudgetGroup, BudgetGroupInput, BudgetGroupUpdate, IntegrityReport } from '@accounting/shared'
import { apiFetch, qs } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'

export const COA_API = '/api/chart-of-accounts'

// All keys start with ['coa'] and carry the empresa id, so a prefix invalidation refreshes everything.
export const coaKeys = {
  accounts: (empresaId: string) => ['coa', 'accounts', empresaId] as const,
  groups: (empresaId: string) => ['coa', 'budget-groups', empresaId] as const,
  integrity: (empresaId: string) => ['coa', 'integrity', empresaId] as const,
}

const byCode = (a: Account, b: Account) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)

// Whole catalog (active and inactive), ordered by code. One shared request for every consumer.
export function useAccounts() {
  const { empresa } = useEmpresa()
  const query = useQuery<Account[]>({
    queryKey: coaKeys.accounts(empresa.id),
    queryFn: async () => (await apiFetch<Account[]>(`${COA_API}/accounts${qs({ includeInactive: true })}`)).sort(byCode),
    staleTime: 60_000,
  })
  const byId = useMemo(() => new Map((query.data ?? []).map((a) => [a.id, a])), [query.data])
  return { ...query, byId }
}

// All budget groups, active and inactive.
export function useBudgetGroups() {
  const { empresa } = useEmpresa()
  return useQuery<BudgetGroup[]>({
    queryKey: coaKeys.groups(empresa.id),
    queryFn: () => apiFetch(`${COA_API}/budget-groups${qs({ includeInactive: true })}`),
  })
}

export function useIntegrityReport(enabled: boolean) {
  const { empresa } = useEmpresa()
  return useQuery<IntegrityReport>({
    queryKey: coaKeys.integrity(empresa.id),
    queryFn: () => apiFetch(`${COA_API}/integrity`),
    enabled,
  })
}

// Every mutation refetches before it resolves, so callers can select the result right after `await`.
export function useCoaMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['coa'] })
  const post = <T,>(path: string) => apiFetch<T>(`${COA_API}${path}`, { method: 'POST' })

  const saveAccount = useMutation({
    mutationFn: (v: { id?: string; input: AccountInput | AccountUpdate }) =>
      v.id
        ? apiFetch<Account>(`${COA_API}/accounts/${v.id}`, { method: 'PATCH', json: v.input })
        : apiFetch<Account>(`${COA_API}/accounts`, { json: v.input }),
    onSuccess: refresh,
  })
  const setAccountActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      post<Account>(`/accounts/${v.id}/${v.active ? 'reactivate' : 'deactivate'}`),
    onSuccess: refresh,
  })
  const createGroup = useMutation({
    mutationFn: (input: BudgetGroupInput) => apiFetch<BudgetGroup>(`${COA_API}/budget-groups`, { json: input }),
    onSuccess: refresh,
  })
  const updateGroup = useMutation({
    mutationFn: (v: { id: string; input: BudgetGroupUpdate }) =>
      apiFetch<BudgetGroup>(`${COA_API}/budget-groups/${v.id}`, { method: 'PATCH', json: v.input }),
    onSuccess: refresh,
  })
  const setGroupActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      post<BudgetGroup>(`/budget-groups/${v.id}/${v.active ? 'reactivate' : 'deactivate'}`),
    onSuccess: refresh,
  })
  return { saveAccount, setAccountActive, createGroup, updateGroup, setGroupActive }
}
