'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { authClient } from '@/lib/auth-client'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    Promise.all([
      apiFetch<{ needsSetup: boolean }>('/api/setup/status').catch(() => ({ needsSetup: false })),
      authClient.getSession(),
    ]).then(([{ needsSetup }, sessionRes]) => {
      if (needsSetup) router.replace('/setup')
      else if (!sessionRes.data?.session) router.replace('/login')
      else router.replace('/dashboard')
    })
  }, [router])

  return null
}
