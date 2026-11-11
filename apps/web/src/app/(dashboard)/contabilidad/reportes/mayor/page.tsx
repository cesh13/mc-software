'use client'

import { Suspense } from 'react'
import { Loading } from '@/components/ui/feedback'
import { AccountLedgerScreen } from '@/components/contabilidad/reports/AccountLedgerScreen'

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AccountLedgerScreen />
    </Suspense>
  )
}
