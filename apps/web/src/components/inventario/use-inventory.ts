'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InvDocument, InvDocumentSummary, Item, ItemGroup, MovementType, Warehouse } from '@accounting/shared'
import { apiFetch, qs } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'

export const INV_API = '/api/inventory'

// Every key starts with ['inv', empresaId] so one prefix invalidation refreshes lists and reports.
export const invKey = (empresaId: string, ...rest: unknown[]) => ['inv', empresaId, ...rest] as const

export type Catalog = 'warehouses' | 'groups' | 'movement-types'
type CatalogRow = { warehouses: Warehouse; groups: ItemGroup; 'movement-types': MovementType }

export function useCatalog<C extends Catalog>(catalog: C, inactive = false) {
  const { empresa } = useEmpresa()
  return useQuery<CatalogRow[C][]>({
    queryKey: invKey(empresa.id, catalog, inactive),
    queryFn: () => apiFetch(`${INV_API}/${catalog}${qs({ inactive: inactive ? 1 : undefined })}`),
    staleTime: 60_000,
  })
}

export function useItems(inactive = false) {
  const { empresa } = useEmpresa()
  return useQuery<Item[]>({
    queryKey: invKey(empresa.id, 'items', inactive),
    queryFn: () => apiFetch(`${INV_API}/items${qs({ inactive: inactive ? 1 : undefined })}`),
    staleTime: 30_000,
  })
}

export function useDocuments(filter: { from: string; to: string; typeId?: string; warehouseId?: string }) {
  const { empresa } = useEmpresa()
  return useQuery<InvDocumentSummary[]>({
    queryKey: invKey(empresa.id, 'documents', filter),
    queryFn: () => apiFetch(`${INV_API}/documents${qs(filter)}`),
  })
}

export function useDocument(id: string | null) {
  const { empresa } = useEmpresa()
  return useQuery<InvDocument>({
    queryKey: invKey(empresa.id, 'document', id),
    queryFn: () => apiFetch(`${INV_API}/documents/${id}`),
    enabled: !!id,
  })
}

export function useReport<T>(path: string, params: Record<string, string | undefined>, enabled = true) {
  const { empresa } = useEmpresa()
  return useQuery<T>({
    queryKey: invKey(empresa.id, 'report', path, params),
    queryFn: () => apiFetch(`${INV_API}/reports/${path}${qs(params)}`),
    enabled,
  })
}

// Generic mutation that refreshes every inventory query of the empresa.
export function useInvMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  const { empresa } = useEmpresa()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', empresa.id] }) })
}

export function useCatalogMutations(catalog: Catalog | 'items') {
  const base = `${INV_API}/${catalog}`
  const save = useInvMutation((v: { id?: string; input: Record<string, unknown> }) =>
    v.id ? apiFetch(`${base}/${v.id}`, { method: 'PATCH', json: v.input }) : apiFetch(base, { json: v.input }))
  const setActive = useInvMutation((v: { id: string; active: boolean }) =>
    apiFetch(`${base}/${v.id}/${v.active ? 'reactivate' : 'deactivate'}`, { method: 'POST' }))
  return { save, setActive }
}
