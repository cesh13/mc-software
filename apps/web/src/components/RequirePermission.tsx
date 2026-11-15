'use client'

import type { ReactNode } from 'react'
import { usePermissions } from '@/lib/permissions'
import { Alert, Loading } from './ui/feedback'

export const NO_ACCESS = 'No tiene acceso a esta opción.'

// Renders children only when the user has the permission; otherwise a notice,
// so the screen never fires requests that would answer 403.
export function RequirePermission({ permission, children }: { permission?: string; children: ReactNode }) {
  const { can, loading } = usePermissions()
  if (!permission) return <>{children}</>
  if (loading) return <Loading />
  if (!can(permission)) return <Alert kind="warning">{NO_ACCESS}</Alert>
  return <>{children}</>
}
