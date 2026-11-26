'use client'

import type { ReactNode } from 'react'
import { errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { openPrintPreview } from '@/lib/print'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'
import { ActionToolbar } from '@/components/ui/toolbar'

// Frame of every inventory report: title, filters, print, states.
export function ReportShell(p: {
  title: string; subtitle: string; filters: ReactNode; loading: boolean; error: unknown; empty: boolean; children: ReactNode
}) {
  const { empresa } = useEmpresa()
  return (
    <div>
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold">{empresa.name}</h1>
        <p className="text-sm">{p.title} · {p.subtitle}</p>
      </div>
      <PageHeader title={p.title} subtitle={empresa.name} />
      <div className="mb-3 flex flex-wrap items-end gap-3 print:hidden">
        <ActionToolbar actions={{ imprimir: openPrintPreview }} />
        {p.filters}
      </div>
      {p.loading && <Loading />}
      {p.error != null && <Alert>{errorMessage(p.error)}</Alert>}
      {!p.loading && p.error == null && p.empty && <p className="py-6 text-sm text-gray-500">No hay datos para los filtros elegidos.</p>}
      {!p.empty && p.children}
    </div>
  )
}
