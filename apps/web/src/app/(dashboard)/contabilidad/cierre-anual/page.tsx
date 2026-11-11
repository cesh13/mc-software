'use client'

import { Suspense } from 'react'
import { Loading } from '@/components/ui/feedback'
import { AnnualCloseScreen } from '@/components/contabilidad/reports/AnnualCloseScreen'

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AnnualCloseScreen />
    </Suspense>
  )
}
