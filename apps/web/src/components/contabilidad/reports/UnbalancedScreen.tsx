'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isPeriod, periodLabel, type EntryListItem, type Period } from '@accounting/shared'
import { formatDate } from '@/lib/format'
import { useWorkPeriod } from '@/lib/work-period'
import { Alert } from '@/components/ui/feedback'
import { Checkbox } from '@/components/ui/form'
import { MonthPicker } from '@/components/ui/month-picker'
import { MoneyTd, Table, Td, Th, rowClass } from '@/components/ui/table'
import { ReportFrame } from './ReportFrame'
import { useReport } from './api'

// Borradores and imported entries with a difference. `?period=` filters by month.
export function UnbalancedScreen() {
  const [work] = useWorkPeriod()
  const fromUrl = useSearchParams().get('period')
  const [period, setPeriod] = useState<Period>(isPeriod(fromUrl) ? fromUrl : work)
  const [allMonths, setAllMonths] = useState(!isPeriod(fromUrl))
  const { data, isLoading, error } = useReport<EntryListItem[]>('entries/unbalanced', {
    period: allMonths ? null : period,
  })

  return (
    <ReportFrame
      title="Partidas descuadradas"
      range={allMonths ? 'Todos los meses' : periodLabel(period)}
      loading={isLoading}
      error={error}
      params={
        <>
          <Checkbox label="Todos los meses" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} />
          {!allMonths && <MonthPicker value={period} onChange={setPeriod} />}
        </>
      }
    >
      {data && data.length === 0 && (
        <Alert kind="success">No hay partidas en borrador ni descuadradas{allMonths ? '' : ' en este mes'}.</Alert>
      )}
      {data && data.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">{data.length} partida(s) pendientes de revisar.</p>
          <Table>
            <thead>
              <tr>
                <Th>Tipo</Th>
                <Th>Número</Th>
                <Th>Fecha</Th>
                <Th>Concepto</Th>
                <Th className="text-right">Cargos</Th>
                <Th className="text-right">Abonos</Th>
                <Th className="text-right">Diferencia</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className={rowClass}>
                  <Td className="font-mono text-xs">{e.entryTypeCode}</Td>
                  <Td className="font-mono text-xs">
                    <Link
                      className="text-blue-700 hover:underline print:text-black"
                      href={`/contabilidad/partidas?id=${e.id}`}
                    >
                      {e.number}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(e.date)}</Td>
                  <Td>{e.concept}</Td>
                  <MoneyTd value={e.totals.debit} showZero />
                  <MoneyTd value={e.totals.credit} showZero />
                  <MoneyTd value={e.totals.difference} showZero />
                  <Td className="whitespace-nowrap">
                    {e.status === 'borrador' ? 'Borrador' : 'Importada con diferencia'}
                    {!allMonths ? '' : ` · ${e.period}`}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </ReportFrame>
  )
}
