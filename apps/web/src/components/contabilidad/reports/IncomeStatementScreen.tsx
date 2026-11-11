'use client'

import { useState } from 'react'
import { isPeriod, periodLabel, type IncomeStatement, type Period } from '@accounting/shared'
import { useWorkPeriod } from '@/lib/work-period'
import { MonthPicker } from '@/components/ui/month-picker'
import { MoneyTd, Table, Td } from '@/components/ui/table'
import { ReportFrame, totalRowClass } from './ReportFrame'
import { LevelSelect } from './params'
import { StatementTable } from './StatementTable'
import { useFiscalYearOf, useReport } from './api'

// Estado de resultados from/to month (default: fiscal-year start to the working month).
export function IncomeStatementScreen() {
  const [work] = useWorkPeriod()
  const fiscalYear = useFiscalYearOf(work)
  const [fromPick, setFrom] = useState<Period | null>(null)
  const [toPick, setTo] = useState<Period | null>(null)
  const [level, setLevel] = useState<number | null>(null)
  const from = fromPick ?? fiscalYear.data?.startPeriod ?? null
  const to = toPick ?? work
  const valid = isPeriod(from) && isPeriod(to) && from <= to
  const { data, isLoading, error } = useReport<IncomeStatement>(
    'reports/income-statement',
    { from, to },
    valid,
  )

  return (
    <ReportFrame
      title="Estado de resultados"
      range={isPeriod(from) ? `De ${periodLabel(from)} a ${periodLabel(to)}` : ''}
      loading={isLoading || (!from && fiscalYear.isLoading)}
      error={error ?? (from ? null : fiscalYear.error)}
      params={
        <>
          <div role="group" aria-label="Desde" className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Desde</span>
            {from ? <MonthPicker value={from} onChange={setFrom} /> : <span className="text-sm text-gray-500">…</span>}
          </div>
          <div role="group" aria-label="Hasta" className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Hasta</span>
            <MonthPicker value={to} onChange={setTo} />
          </div>
          <LevelSelect value={level} onChange={setLevel} />
        </>
      }
    >
      {!valid && from && <p className="py-6 text-sm text-gray-500">El mes inicial es posterior al final.</p>}
      {valid && data && (
        <div className="max-w-3xl space-y-4">
          <StatementTable title="Ingresos" rows={data.ingresos.rows} level={level} total={data.ingresos.total} />
          <StatementTable title="Gastos" rows={data.gastos.rows} level={level} total={data.gastos.total} />
          <Table>
            <tbody>
              <tr className={totalRowClass}>
                <Td>Utilidad o pérdida del período</Td>
                <MoneyTd value={data.netResult} bold showZero />
              </tr>
            </tbody>
          </Table>
        </div>
      )}
    </ReportFrame>
  )
}
