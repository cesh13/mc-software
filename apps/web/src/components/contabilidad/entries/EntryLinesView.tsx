import type { EntryLine } from '@accounting/shared'
import { MoneyTd, Td, Th } from '@/components/ui/table'

// Read-only lines (consulta mode and the printed entry).
export function EntryLinesView({ lines, label = 'Líneas de la partida' }: { lines: EntryLine[]; label?: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white print:border-0">
      <table className="w-full border-collapse text-sm print:text-xs" aria-label={label}>
        <thead>
          <tr>
            <Th className="w-10 text-right">#</Th>
            <Th className="w-40">Cuenta</Th>
            <Th>Nombre de la cuenta</Th>
            <Th className="w-20">C. costo</Th>
            <Th>Detalle</Th>
            <Th className="w-32 text-right">Cargo</Th>
            <Th className="w-32 text-right">Abono</Th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <Td colSpan={7} className="py-4 text-center text-gray-500">La partida no tiene líneas.</Td>
            </tr>
          )}
          {lines.map((l) => (
            <tr key={l.id} className="print:break-inside-avoid">
              <Td className="text-right text-xs tabular-nums text-gray-500">{l.lineNo}</Td>
              <Td className="whitespace-nowrap font-mono text-xs">{l.accountCode}</Td>
              <Td>{l.accountName}</Td>
              <Td className="font-mono text-xs" title={l.costCenterName ?? undefined}>{l.costCenterCode ?? ''}</Td>
              <Td>{l.detail}</Td>
              <MoneyTd value={l.debit} />
              <MoneyTd value={l.credit} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
