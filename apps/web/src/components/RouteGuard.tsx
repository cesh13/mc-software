'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { permissionForPath } from '@/lib/nav'
import { RequirePermission } from './RequirePermission'

// Blocks a page opened directly (URL, bookmark) when the user cannot open it.
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return <RequirePermission permission={permissionForPath(pathname)}>{children}</RequirePermission>
}
