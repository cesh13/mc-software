'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './api'
import { useEmpresa } from './empresa'

export type MyPermissions = {
  role: string
  packages: string[]
  empresaId: string | null
  permissions: string[]
}

type Ctx = { can: (permission: string) => boolean; loading: boolean }

const PermissionsContext = createContext<Ctx>({ can: () => false, loading: true })

// Effective fine permissions of the signed-in user in the active empresa.
// The API checks again on every request; this only drives what the UI shows.
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { empresa } = useEmpresa()
  const { data, isLoading } = useQuery<MyPermissions>({
    queryKey: ['permissions', 'me', empresa.id],
    queryFn: () => apiFetch(`/api/permissions/me?empresa=${encodeURIComponent(empresa.id)}`),
    staleTime: 60_000,
  })
  const value = useMemo<Ctx>(() => {
    const set = new Set(data?.permissions ?? [])
    return { can: (p) => set.has(p), loading: isLoading }
  }, [data, isLoading])
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): Ctx {
  return useContext(PermissionsContext)
}
