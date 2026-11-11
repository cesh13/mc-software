'use client'

import { useState } from 'react'
import { addMoney, isZeroMoney, periodLabel, type BalanceSheet } from '@accounting/shared'
import { formatMoney } from '@/lib/format'
import { Alert } from '@/components/ui/feedback'
import { MonthPicker } from '@/components/ui/month-picker'
import { MoneyTd, Table, Td } from '@/components/ui/table'
import { ReportFrame, totalRowClass } from './ReportFrame'
import { LevelSelect, usePeriodParam } from './params'
import { StatementLine, StatementTable, StatementTotal } from './StatementTable'
import { useReport } from './api'

export function BalanceSheetScreen() {
  const [period, setPeriod] = usePeriodParam()
  const [level, setLevel] = useState<number | null>(null)
  const { data, isLoading, error } = useReport<BalanceSheet>('reports/balance-sheet', { period })

  return (
    <ReportFrame
      title="Balance general"
      range={`Al cierre de ${periodLabel(period)}`}
      loading={isLoading}
      error={error}
      params={
        <>
          <MonthPicker value={period} onChange={setPeriod} />
          <LevelSelect value={level} onChange={setLevel} />
        </>
      }
    >
      {data && <Body data={data} level={level} />}
    </ReportFrame>
  )
}

function Body({ data, level }: { data: BalanceSheet; level: number | null }) {
  const right = addMoney(data.pasivo.total, data.capital.total, data.currentYearResult, data.priorYearsResult)
  const consistent = isZeroMoney(data.difference)
  const hasOrden = data.orden.rows.length > 0 || data.contra.rows.length > 0
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Ejercicio fiscal {data.fiscalYear.name}: {periodLabel(data.fiscalYear.startPeriod)} a{' '}
        {periodLabel(data.fiscalYear.endPeriod)}.
      </p>
      <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-1">
        <StatementTable title="Activo" rows={data.activo.rows} level={level} total={data.activo.total} />
        <div className="space-y-4">
          <StatementTable title="Pasivo" rows={data.pasivo.rows} level={level} total={data.pasivo.total} />
          <StatementTable title="Capital" rows={data.capital.rows} level={level} total={data.capital.total}>
            <StatementLine label="Resultado de ejercicios anteriores" value={data.priorYearsResult} />
            <StatementLine label="Resultado del ejercicio" value={data.currentYearResult} />
            <StatementTotal label="Total capital y resultados" value={addMoney(data.capital.total, data.priorYearsResult, data.currentYearResult)} />
          </StatementTable>
          <Table>
            <tbody>
              <tr className={totalRowClass}>
                <Td>Total pasivo + capital + resultados</Td>
                <MoneyTd value={right} bold showZero />
              </tr>
            </tbody>
          </Table>
        </div>
      </div>
      {consistent ? (
        <Alert kind="success">
          Activo ({formatMoney(data.activo.total)}) = Pasivo + Capital + Resultados ({formatMoney(right)}). El balance cuadra.
        </Alert>
      ) : (
        <Alert kind="warning">
          El balance no cuadra: Activo {formatMoney(data.activo.total)} contra Pasivo + Capital + Resultados{' '}
          {formatMoney(right)}; diferencia {formatMoney(data.difference)}. Revise las partidas descuadradas y el catálogo.
        </Alert>
      )}
      {hasOrden && (
        <div className="space-y-2 break-inside-avoid">
          <h2 className="text-sm font-semibold text-gray-700">Cuentas de orden y contra (informativas)</h2>
          <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-1">
            {data.orden.rows.length > 0 && (
              <StatementTable title="Cuentas de orden" rows={data.orden.rows} level={level} total={data.orden.total} />
            )}
            {data.contra.rows.length > 0 && (
              <StatementTable title="Cuentas contra" rows={data.contra.rows} level={level} total={data.contra.total} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
