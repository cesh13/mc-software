'use client'

import { Suspense } from 'react'
import { Loading } from '@/components/ui/feedback'
import { UnbalancedScreen } from '@/components/contabilidad/reports/UnbalancedScreen'

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <UnbalancedScreen />
    </Suspense>
  )
}
