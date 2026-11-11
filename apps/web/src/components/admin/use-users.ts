'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role } from '@accounting/shared'
import { apiFetch } from '@/lib/api'

// The five roles that can be assigned (admin/member are legacy aliases).
export const ASSIGNABLE_ROLES = ['owner', 'supervisor', 'digitador_consulta', 'digitador', 'consulta'] as const satisfies readonly Role[]
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

export const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  owner: 'Capturar, ver reportes y supervisar; administra a otros propietarios y entra a todas las empresas.',
  supervisor: 'Capturar, ver reportes y supervisar (cierres, configuración y usuarios).',
  digitador_consulta: 'Capturar y ver reportes.',
  digitador: 'Solo capturar.',
  consulta: 'Solo ver reportes.',
}

export type AdminUser = {
  id: string
  name: string
  email: string
  role: string
  banned: boolean
  empresaIds: string[]
}

export type UserForm = {
  name: string
  email: string
  password: string
  role: AssignableRole
  empresaIds: string[]
}

export function useUsers(enabled: boolean) {
  return useQuery<AdminUser[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/api/users'),
    enabled,
  })
}

export function useUserMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: ['users'] })
  const create = useMutation({
    mutationFn: (f: UserForm) => apiFetch<AdminUser>('/api/users', { json: f }),
    onSuccess: done,
  })
  // Changes run one after the other; the first failure stops the rest.
  const update = useMutation({
    mutationFn: async (v: { id: string; patch?: { name?: string; role?: string }; empresaIds?: string[] }) => {
      if (v.patch) await apiFetch(`/api/users/${v.id}`, { method: 'PATCH', json: v.patch })
      if (v.empresaIds) await apiFetch(`/api/users/${v.id}/empresas`, { method: 'PUT', json: { empresaIds: v.empresaIds } })
    },
    onSettled: done,
  })
  const setBanned = useMutation({
    mutationFn: (v: { id: string; banned: boolean }) =>
      apiFetch(`/api/users/${v.id}`, { method: 'PATCH', json: { banned: v.banned } }),
    onSuccess: done,
  })
  return { create, update, setBanned }
}
