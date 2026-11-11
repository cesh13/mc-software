'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { useCurrentUser } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

// Print-only header: empresa, report title, period or range, print date.
export function PrintHeader({ title, range }: { title: string; range?: string }) {
  const { empresa } = useEmpresa()
  const [date, setDate] = useState('')
  useEffect(() => setDate(today()), [])
  return (
    <div className="mb-3 hidden border-b border-gray-800 pb-2 print:block">
      <p className="text-base font-bold">{empresa.name}</p>
      <p className="text-sm font-semibold">{title}</p>
      <div className="flex justify-between text-xs">
        <span>{range}</span>
        <span>Impreso: {date}</span>
      </div>
    </div>
  )
}

// Class for a grand-total row: bold with a top border.
export const totalRowClass = 'border-t-2 border-gray-800 bg-gray-50 font-semibold'

export type ReportFrameProps = {
  title: string
  // Period or range shown under the title and in the print header.
  range?: string
  // Parameter bar; hidden when printing.
  params?: ReactNode
  loading?: boolean
  error?: unknown
  // Message shown instead of the body when the report has no data.
  empty?: string | null
  // Set false to render only the notice (e.g. while a required parameter is missing).
  ready?: boolean
  children: ReactNode
}

// Common frame of every report: header, parameter bar, print header and the
// loading / empty / error / no-permission states.
export function ReportFrame({ title, range, params, loading, error, empty, ready = true, children }: ReportFrameProps) {
  const { empresa } = useEmpresa()
  const { can } = useCurrentUser()
  if (!can('reports')) {
    return (
      <div className="max-w-5xl">
        <PageHeader title={title} subtitle={empresa.name} />
        <Alert kind="warning">No tiene permiso para ver este reporte.</Alert>
      </div>
    )
  }
  return (
    <div>
      <PrintHeader title={title} range={range} />
      <PageHeader
        title={title}
        subtitle={range ? `${empresa.name} · ${range}` : empresa.name}
        actions={
          <Button onClick={() => window.print()}>
            <Printer size={14} /> Imprimir
          </Button>
        }
      />
      {params && (
        <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 print:hidden">
          {params}
        </div>
      )}
      {ready && loading && <Loading />}
      {ready && !!error && <Alert>{errorMessage(error)}</Alert>}
      {ready && !loading && !error && empty && <p className="py-6 text-sm text-gray-500">{empty}</p>}
      {ready && !loading && !error && !empty && children}
    </div>
  )
}
