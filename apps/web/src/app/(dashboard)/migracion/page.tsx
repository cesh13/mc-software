'use client'

import { Suspense } from 'react'
import { Loading } from '@/components/ui/feedback'
import { MigrationScreen } from '@/components/migration/MigrationScreen'

export default function MigracionPage() {
  return (
    <Suspense fallback={<Loading />}>
      <MigrationScreen />
    </Suspense>
  )
}
