'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rolePackages, type PermissionDef, type PermissionOverride } from '@accounting/shared'
import { apiFetch } from '@/lib/api'

export type UserPermissions = {
  userId: string
  role: string
  overrides: PermissionOverride[]
  effective: string[]
}

export type Effect = PermissionOverride['effect']

export function usePermissionCatalog() {
  return useQuery<PermissionDef[]>({
    queryKey: ['permissions', 'catalog'],
    queryFn: () => apiFetch('/api/permissions/catalog'),
    staleTime: 5 * 60_000,
  })
}

export function useUserPermissions(userId: string) {
  return useQuery<UserPermissions>({
    queryKey: ['permissions', 'user', userId],
    queryFn: () => apiFetch(`/api/permissions/users/${encodeURIComponent(userId)}`),
    gcTime: 0,
  })
}

export function useSaveOverrides(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (overrides: PermissionOverride[]) =>
      apiFetch(`/api/permissions/users/${encodeURIComponent(userId)}`, { method: 'PUT', json: { overrides } }),
    // Also refreshes the caller's own menu if the change somehow reaches them.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['permissions'] }),
  })
}

/** What the role alone grants. */
export function roleDefault(role: string, def: PermissionDef): boolean {
  if (role === 'owner') return true
  const packages = rolePackages(role)
  return def.packages.some((p) => packages.includes(p))
}

/** Override that applies in a scope: the empresa's first, then the global one. */
export function overrideIn(
  overrides: readonly PermissionOverride[],
  permission: string,
  scope: string | null,
): Effect | null {
  const pick = (empresaId: string | null): Effect | null => {
    const rows = overrides.filter((o) => o.permission === permission && o.empresaId === empresaId)
    if (rows.some((o) => o.effect === 'deny')) return 'deny'
    if (rows.some((o) => o.effect === 'grant')) return 'grant'
    return null
  }
  return (scope ? pick(scope) : null) ?? pick(null)
}

/** Same order as the API: owner always, empresa override, global override, role. */
export function effectiveIn(
  role: string,
  def: PermissionDef,
  overrides: readonly PermissionOverride[],
  scope: string | null,
): boolean {
  if (role === 'owner') return true
  const ov = overrideIn(overrides, def.id, scope)
  return ov ? ov === 'grant' : roleDefault(role, def)
}

/** Replaces the override of one permission in one scope. */
export function setOverride(
  overrides: readonly PermissionOverride[],
  permission: string,
  scope: string | null,
  effect: Effect | null,
): PermissionOverride[] {
  const rest = overrides.filter((o) => !(o.permission === permission && o.empresaId === scope))
  return effect ? [...rest, { permission, effect, empresaId: scope }] : rest
}
