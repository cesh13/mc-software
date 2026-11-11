'use client'

import type { AnnualClosePreview as Preview } from '@accounting/shared'
import { formatDate, formatMoney } from '@/lib/format'
import { Alert } from '@/components/ui/feedback'
import { MoneyTd, Table, Td, Th } from '@/components/ui/table'
import { totalRowClass } from './ReportFrame'

// Draft closing entry: lines, totals and the result of the fiscal year.
export function AnnualClosePreview({ preview }: { preview: Preview }) {
  const loss = preview.result.startsWith('-')
  const zero = /^-?0+(\.0+)?$/.test(preview.result)
  const amount = formatMoney(loss ? preview.result.slice(1) : preview.result)
  return (
    <div className="space-y-3">
      <div className="text-sm">
        <p className="font-semibold">{preview.concept}</p>
        <p className="text-gray-600">
          Tipo y número: {preview.number} · Fecha: {formatDate(preview.date)} · Ejercicio {preview.fiscalYear.name}
        </p>
      </div>
      {preview.alreadyClosed && (
        <Alert kind="warning">Este ejercicio ya tiene partida de cierre. Anúlela antes de cerrar de nuevo.</Alert>
      )}
      {preview.lines.length === 0 ? (
        <Alert kind="info">No hay saldos de gastos ni ingresos que cerrar.</Alert>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Cuenta</Th>
              <Th>Nombre</Th>
              <Th>C. costo</Th>
              <Th className="text-right">Cargo</Th>
              <Th className="text-right">Abono</Th>
            </tr>
          </thead>
          <tbody>
            {preview.lines.map((l) => (
              <tr key={l.lineNo}>
                <Td className="whitespace-nowrap font-mono text-xs">{l.accountCode}</Td>
                <Td>{l.accountName}</Td>
                <Td className="font-mono text-xs">{l.costCenterCode}</Td>
                <MoneyTd value={l.debit} />
                <MoneyTd value={l.credit} />
              </tr>
            ))}
            <tr className={totalRowClass}>
              <Td colSpan={3}>Totales</Td>
              <MoneyTd value={preview.totals.debit} bold showZero />
              <MoneyTd value={preview.totals.credit} bold showZero />
            </tr>
          </tbody>
        </Table>
      )}
      <p
        className={`rounded-md border px-3 py-2 text-sm font-semibold ${
          zero
            ? 'border-gray-200 bg-gray-50 text-gray-800'
            : loss
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-green-200 bg-green-50 text-green-900'
        }`}
      >
        {zero ? 'Resultado del ejercicio: sin utilidad ni pérdida' : `${loss ? 'Pérdida' : 'Utilidad'} del ejercicio: ${amount}`}
      </p>
    </div>
  )
}
