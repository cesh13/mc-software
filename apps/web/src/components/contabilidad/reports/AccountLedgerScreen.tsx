'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isIsoDate, lastDayOfPeriod, type AccountLedger } from '@accounting/shared'
import { formatDate } from '@/lib/format'
import { useWorkPeriod } from '@/lib/work-period'
import { Field, Input } from '@/components/ui/form'
import { MoneyTd, Table, Td, Th, rowClass } from '@/components/ui/table'
import { AccountPicker } from '../AccountPicker'
import { ReportFrame, totalRowClass } from './ReportFrame'
import { CostCenterSelect } from './params'
import { useReport } from './api'

// Libro mayor of one account. Accepts ?accountId=&from=&to=&costCenterId=.
export function AccountLedgerScreen() {
  const [work] = useWorkPeriod()
  const sp = useSearchParams()
  const fromParam = sp.get('from')
  const toParam = sp.get('to')
  const [accountId, setAccountId] = useState<string | null>(sp.get('accountId'))
  const [from, setFrom] = useState(isIsoDate(fromParam) ? fromParam : `${work}-01`)
  const [to, setTo] = useState(isIsoDate(toParam) ? toParam : lastDayOfPeriod(work))
  const [costCenterId, setCostCenterId] = useState(sp.get('costCenterId') ?? '')
  const datesOk = isIsoDate(from) && isIsoDate(to)
  const valid = !!accountId && datesOk && from <= to
  const { data, isLoading, error } = useReport<AccountLedger>(
    'reports/account-ledger',
    { accountId, from, to, costCenterId },
    valid,
  )

  const title = data ? `Libro mayor: ${data.account.code} ${data.account.name}` : 'Libro mayor'
  return (
    <ReportFrame
      title={title}
      range={datesOk ? `Del ${formatDate(from)} al ${formatDate(to)}` : ''}
      loading={valid && isLoading}
      error={valid ? error : null}
      params={
        <>
          <Field label="Cuenta" className="w-72">
            <AccountPicker value={accountId} onChange={(a) => setAccountId(a?.id ?? null)} />
          </Field>
          <Field label="Desde">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <CostCenterSelect value={costCenterId} onChange={setCostCenterId} />
        </>
      }
    >
      {!valid && (
        <p className="py-6 text-sm text-gray-500">
          {datesOk && from > to
            ? 'La fecha inicial es posterior a la final.'
            : 'Seleccione una cuenta y un rango de fechas.'}
        </p>
      )}
      {valid && data && (
        <Table>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Tipo</Th>
              <Th>Número</Th>
              <Th>Detalle</Th>
              <Th className="text-right">Cargo</Th>
              <Th className="text-right">Abono</Th>
              <Th className="text-right">Saldo</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-gray-50 font-semibold">
              <Td colSpan={6}>Saldo anterior</Td>
              <MoneyTd value={data.openingBalance} bold showZero />
            </tr>
            {data.movements.map((m) => (
              <tr key={`${m.entryId}-${m.lineNo}`} className={rowClass}>
                <Td className="whitespace-nowrap">{formatDate(m.date)}</Td>
                <Td className="font-mono text-xs">{m.entryTypeCode}</Td>
                <Td className="font-mono text-xs">
                  <Link
                    className="text-blue-700 hover:underline print:text-black"
                    href={`/contabilidad/partidas?id=${m.entryId}`}
                  >
                    {m.number}
                  </Link>
                </Td>
                <Td>
                  {m.costCenterCode && <span className="mr-1 text-xs text-gray-500">[{m.costCenterCode}]</span>}
                  {m.detail}
                </Td>
                <MoneyTd value={m.debit} />
                <MoneyTd value={m.credit} />
                <MoneyTd value={m.balance} showZero />
              </tr>
            ))}
            {data.movements.length === 0 && (
              <tr>
                <Td colSpan={7} className="text-gray-500">
                  Sin movimientos en el rango.
                </Td>
              </tr>
            )}
            <tr className={totalRowClass}>
              <Td colSpan={4}>Totales</Td>
              <MoneyTd value={data.totals.debits} bold showZero />
              <MoneyTd value={data.totals.credits} bold showZero />
              <Td />
            </tr>
            <tr className={totalRowClass}>
              <Td colSpan={6}>Saldo final</Td>
              <MoneyTd value={data.closingBalance} bold showZero />
            </tr>
          </tbody>
        </Table>
      )}
    </ReportFrame>
  )
}
