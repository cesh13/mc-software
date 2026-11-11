import type { Entry } from '@accounting/shared'
import { formatDate, formatMoney } from '@/lib/format'
import { EntryLinesView } from './EntryLinesView'

// Print-only layout of one entry (window.print()).
export function EntryPrint({ entry, empresa }: { entry: Entry; empresa: string }) {
  const status = !entry.isActive ? 'ANULADA' : entry.status === 'borrador' ? 'BORRADOR' : ''
  return (
    <div className="hidden text-sm text-black print:block">
      <div className="mb-3 border-b border-black pb-2 text-center">
        <p className="text-base font-bold">{empresa}</p>
        <p className="font-semibold">PARTIDA CONTABLE</p>
      </div>
      <div className="mb-3 grid grid-cols-[auto_1fr_auto_auto] gap-x-4 gap-y-1">
        <span className="font-semibold">Tipo:</span>
        <span>{entry.entryTypeCode} — {entry.entryTypeName}</span>
        <span className="font-semibold">Número:</span>
        <span className="font-mono">{entry.number}</span>
        <span className="font-semibold">Concepto:</span>
        <span>{entry.concept}</span>
        <span className="font-semibold">Fecha:</span>
        <span>{formatDate(entry.date)}</span>
      </div>
      {status && <p className="mb-2 font-bold">{status}</p>}
      <EntryLinesView lines={entry.lines} label="Líneas" />
      <div className="mt-2 flex justify-end gap-8 border-t border-black pt-1 font-semibold tabular-nums">
        <span>TOTALES</span>
        <span className="w-32 text-right">{formatMoney(entry.totals.debit)}</span>
        <span className="w-32 text-right">{formatMoney(entry.totals.credit)}</span>
      </div>
      <div className="mt-20 grid grid-cols-3 gap-10 text-center">
        {['Elaborado', 'Revisado', 'Autorizado'].map((label) => (
          <div key={label} className="border-t border-black pt-1">{label}</div>
        ))}
      </div>
    </div>
  )
}
