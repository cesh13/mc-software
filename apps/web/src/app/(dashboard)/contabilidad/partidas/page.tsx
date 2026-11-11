'use client'

import { Suspense } from 'react'
import { Loading } from '@/components/ui/feedback'
import { EntryScreen } from '@/components/contabilidad/entries/EntryScreen'

export default function PartidasPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EntryScreen />
    </Suspense>
  )
}
