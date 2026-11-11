'use client'

import { Suspense } from 'react'
import { Loading } from '@/components/ui/feedback'
import { JournalScreen } from '@/components/contabilidad/reports/JournalScreen'

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <JournalScreen />
    </Suspense>
  )
}
