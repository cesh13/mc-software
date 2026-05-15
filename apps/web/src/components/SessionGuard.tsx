'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authClient.getSession().then(({ data }: any) => {
      if (!data?.session) {
        router.replace('/login')
      } else {
        setReady(true)
      }
    })
  }, [router])

  if (!ready) return null
  return <>{children}</>
}
