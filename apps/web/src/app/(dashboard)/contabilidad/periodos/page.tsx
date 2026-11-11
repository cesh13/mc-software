'use client'

import { Suspense } from 'react'
import { Loading } from '@/components/ui/feedback'
import { PeriodsScreen } from '@/components/contabilidad/reports/PeriodsScreen'

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PeriodsScreen />
    </Suspense>
  )
}
