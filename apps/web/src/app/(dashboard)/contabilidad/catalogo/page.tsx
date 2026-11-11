'use client'

import { Suspense } from 'react'
import { Loading } from '@/components/ui/feedback'
import { CatalogScreen } from '@/components/contabilidad/coa/CatalogScreen'

export default function CatalogoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CatalogScreen />
    </Suspense>
  )
}
