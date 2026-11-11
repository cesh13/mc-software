import { isZeroMoney, type Money } from '@accounting/shared'
import { cx } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'

// TOTAL CARGOS / TOTAL ABONOS / DIFERENCIA, pinned under the lines grid.
export function TotalsBar({ debit, credit, difference }: { debit: Money; credit: Money; difference: Money }) {
  const off = !isZeroMoney(difference)
  const item = (label: string, value: Money, red = false) => (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <span className={cx('min-w-[8rem] text-right font-semibold tabular-nums', red ? 'text-red-700' : 'text-gray-900')}>
        {formatMoney(value)}
      </span>
    </div>
  )
  return (
    <div
      role="status"
      aria-label="Totales"
      className={cx(
        'sticky bottom-0 z-10 mt-2 flex flex-wrap justify-end gap-x-8 gap-y-1 rounded-md border px-4 py-2 shadow-sm print:hidden',
        off ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white',
      )}
    >
      {item('Total cargos', debit)}
      {item('Total abonos', credit)}
      {item('Diferencia', difference, off)}
    </div>
  )
}
