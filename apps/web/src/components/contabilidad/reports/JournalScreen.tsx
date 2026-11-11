'use client'

import { periodLabel, type JournalReport } from '@accounting/shared'
import { formatDate } from '@/lib/format'
import { MonthPicker } from '@/components/ui/month-picker'
import { MoneyTd, Table, Td, Th } from '@/components/ui/table'
import { ReportFrame, totalRowClass } from './ReportFrame'
import { usePeriodParam } from './params'
import { useReport } from './api'

type JournalEntry = JournalReport['entries'][number]

function EntryBlock({ entry }: { entry: JournalEntry }) {
  return (
    <section className="break-inside-avoid">
      <div className="flex flex-wrap items-baseline gap-x-6 rounded-t-md border border-b-0 border-gray-200 bg-gray-100 px-2 py-1.5 text-sm">
        <span className="font-semibold">
          {entry.entryTypeCode}-{entry.number}
        </span>
        <span>{formatDate(entry.date)}</span>
        <span className="min-w-0 flex-1">{entry.concept}</span>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Cuenta</Th>
            <Th>Nombre</Th>
            <Th>C. costo</Th>
            <Th>Detalle</Th>
            <Th className="text-right">Cargo</Th>
            <Th className="text-right">Abono</Th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((l) => (
            <tr key={l.id}>
              <Td className="whitespace-nowrap font-mono text-xs">{l.accountCode}</Td>
              <Td>{l.accountName}</Td>
              <Td className="font-mono text-xs">{l.costCenterCode}</Td>
              <Td>{l.detail}</Td>
              <MoneyTd value={l.debit} />
              <MoneyTd value={l.credit} />
            </tr>
          ))}
          <tr className="font-semibold">
            <Td colSpan={4} className="text-right">
              Total de la partida
            </Td>
            <MoneyTd value={entry.totals.debit} bold showZero />
            <MoneyTd value={entry.totals.credit} bold showZero />
          </tr>
        </tbody>
      </Table>
    </section>
  )
}

export function JournalScreen() {
  const [period, setPeriod] = usePeriodParam()
  const { data, isLoading, error } = useReport<JournalReport>('reports/journal', { period })
  return (
    <ReportFrame
      title="Libro diario"
      range={periodLabel(period)}
      loading={isLoading}
      error={error}
      empty={data && data.entries.length === 0 ? 'No hay partidas aplicadas en el mes.' : null}
      params={<MonthPicker value={period} onChange={setPeriod} />}
    >
      {data && (
        <div className="space-y-4">
          {data.entries.map((e) => (
            <EntryBlock key={e.id} entry={e} />
          ))}
          <Table>
            <tbody>
              <tr className={totalRowClass}>
                <Td>Totales del mes ({data.entries.length} partidas)</Td>
                <MoneyTd value={data.totals.debit} bold showZero />
                <MoneyTd value={data.totals.credit} bold showZero />
              </tr>
            </tbody>
          </Table>
        </div>
      )}
    </ReportFrame>
  )
}
