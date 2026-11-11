'use client'

import { Suspense } from 'react'
import { Loading } from '@/components/ui/feedback'
import { IncomeStatementScreen } from '@/components/contabilidad/reports/IncomeStatementScreen'

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <IncomeStatementScreen />
    </Suspense>
  )
}
