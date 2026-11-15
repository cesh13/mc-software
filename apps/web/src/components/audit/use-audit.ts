'use client'

import { useQuery } from '@tanstack/react-query'
import type { AuditPage } from '@accounting/shared'
import { apiFetch, ApiError, EMPRESA_KEY, qs } from '@/lib/api'
import { getApiBase } from '@/lib/api-base'
import { getStored } from '@/lib/local-store'

export const PAGE_SIZE = 50

export type AuditFilterState = {
  empresaId: string // '' = active empresa, 'all' = every empresa (owners)
  userId: string
  module: string
  entity: string
  from: string
  to: string
  q: string
}

export const EMPTY_FILTERS: AuditFilterState = { empresaId: '', userId: '', module: '', entity: '', from: '', to: '', q: '' }

export function useAudit(f: AuditFilterState, page: number, activeEmpresaId: string) {
  return useQuery<AuditPage>({
    queryKey: ['audit', activeEmpresaId, f, page],
    queryFn: () => apiFetch(`/api/audit${qs({ ...f, limit: PAGE_SIZE, offset: page * PAGE_SIZE })}`),
    placeholderData: (prev) => prev,
  })
}

// Downloads the CSV with the same filters (not paged).
export async function downloadAuditCsv(f: AuditFilterState): Promise<void> {
  const empresaId = getStored(EMPRESA_KEY)
  const res = await fetch(`${getApiBase()}/api/audit/export${qs({ ...f })}`, {
    credentials: 'include',
    headers: empresaId ? { 'X-Empresa-Id': empresaId } : {},
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new ApiError(body.error ?? `Error ${res.status}`, res.status)
  }
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = 'bitacora.csv'
  a.click()
  URL.revokeObjectURL(url)
}
