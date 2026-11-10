'use client'

import { useQuery } from '@tanstack/react-query'
import { can, type Permission } from '@accounting/shared'
import { authClient } from './auth-client'

export type SessionUser = { id: string; name: string; email: string; role: string }

export function useCurrentUser() {
  const { data } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const res = await authClient.getSession()
      return (res?.data?.user ?? null) as SessionUser | null
    },
    staleTime: 5 * 60_000,
  })
  const user = data ?? null
  return {
    user,
    can: (permission: Permission) => can(user?.role, permission),
  }
}
