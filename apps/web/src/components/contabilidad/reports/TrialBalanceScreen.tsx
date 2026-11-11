'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { lastDayOfPeriod, periodLabel, subMoney, type TrialBalance } from '@accounting/shared'
import { formatMoney } from '@/lib/format'
import { cx } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { Checkbox } from '@/components/ui/form'
import { MonthPicker } from '@/components/ui/month-picker'
import { MoneyTd, Table, Td, Th, rowClass } from '@/components/ui/table'
import { ReportFrame, totalRowClass } from './ReportFrame'
import { CostCenterSelect, LevelSelect, indentStyle, usePeriodParam } from './params'
import { useReport } from './api'

export function TrialBalanceScreen() {
  const router = useRouter()
  const [period, setPeriod] = usePeriodParam()
  const [level, setLevel] = useState<number | null>(null)
  const [onlyWithMovement, setOnlyWithMovement] = useState(false)
  const [costCenterId, setCostCenterId] = useState('')
  const { data, isLoading, error } = useReport<TrialBalance>('reports/trial-balance', {
    period,
    level,
    onlyWithMovement,
    costCenterId,
  })

  const openLedger = (accountId: string) =>
    router.push(
      `/contabilidad/reportes/mayor?accountId=${encodeURIComponent(accountId)}&from=${period}-01&to=${lastDayOfPeriod(period)}` +
        (costCenterId ? `&costCenterId=${encodeURIComponent(costCenterId)}` : ''),
    )

  return (
    <ReportFrame
      title="Balance de comprobación"
      range={periodLabel(period)}
      loading={isLoading}
      error={error}
      empty={data && data.rows.length === 0 ? 'No hay cuentas para mostrar con estos parámetros.' : null}
      params={
        <>
          <MonthPicker value={period} onChange={setPeriod} />
          <LevelSelect value={level} onChange={setLevel} />
          <CostCenterSelect value={costCenterId} onChange={setCostCenterId} />
          <Checkbox
            label="Solo cuentas con movimiento"
            checked={onlyWithMovement}
            onChange={(e) => setOnlyWithMovement(e.target.checked)}
          />
        </>
      }
    >
      {data && (
        <div className="space-y-3">
          {!data.totals.balanced && (
            <Alert kind="warning">
              Los cargos y abonos del mes no coinciden (diferencia {formatMoney(subMoney(data.totals.debits, data.totals.credits))}).{' '}
              <Link
                className="font-medium underline"
                href={`/contabilidad/reportes/descuadradas?period=${period}`}
              >
                Ver partidas descuadradas
              </Link>
            </Alert>
          )}
          <Table>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Cuenta</Th>
                <Th className="text-right">Saldo anterior</Th>
                <Th className="text-right">Cargos</Th>
                <Th className="text-right">Abonos</Th>
                <Th className="text-right">Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr
                  key={r.accountId}
                  className={cx(rowClass, 'cursor-pointer')}
                  tabIndex={0}
                  title="Ver libro mayor"
                  onClick={() => openLedger(r.accountId)}
                  onKeyDown={(e) => e.key === 'Enter' && openLedger(r.accountId)}
                >
                  <Td className={cx('whitespace-nowrap font-mono text-xs', !r.isDetail && 'font-bold')}>{r.code}</Td>
                  <Td className={r.isDetail ? '' : 'font-bold'} style={indentStyle(r.level)}>
                    {r.name}
                  </Td>
                  <MoneyTd value={r.previousBalance} bold={!r.isDetail} />
                  <MoneyTd value={r.debits} bold={!r.isDetail} />
                  <MoneyTd value={r.credits} bold={!r.isDetail} />
                  <MoneyTd value={r.balance} bold={!r.isDetail} />
                </tr>
              ))}
              <tr className={totalRowClass}>
                <Td colSpan={3}>Total de cuentas de detalle</Td>
                <MoneyTd value={data.totals.debits} bold showZero />
                <MoneyTd value={data.totals.credits} bold showZero />
                <Td />
              </tr>
            </tbody>
          </Table>
        </div>
      )}
    </ReportFrame>
  )
}
