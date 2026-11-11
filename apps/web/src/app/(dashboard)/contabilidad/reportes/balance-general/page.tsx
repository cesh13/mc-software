'use client'

import { Suspense } from 'react'
import { Loading } from '@/components/ui/feedback'
import { BalanceSheetScreen } from '@/components/contabilidad/reports/BalanceSheetScreen'

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <BalanceSheetScreen />
    </Suspense>
  )
}
