'use client'

import { Suspense } from 'react'
import { Loading } from '@/components/ui/feedback'
import { TrialBalanceScreen } from '@/components/contabilidad/reports/TrialBalanceScreen'

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <TrialBalanceScreen />
    </Suspense>
  )
}
