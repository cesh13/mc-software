import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cx } from './button'
import { formatMoney } from '@/lib/format'

// Dense data-grid styling shared by every list and report.

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-auto rounded-md border border-gray-200 bg-white print:border-0">
      <table className={cx('w-full border-collapse text-sm', className)} {...props} />
    </div>
  )
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cx(
        'sticky top-0 border-b border-gray-200 bg-gray-100 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx('border-b border-gray-100 px-2 py-1 align-top', className)} {...props} />
}

// Right-aligned amount cell. Blank when zero unless `showZero`.
export function MoneyTd({
  value,
  showZero,
  bold,
  className,
}: {
  value: string | null | undefined
  showZero?: boolean
  bold?: boolean
  className?: string
}) {
  const negative = !!value && value.startsWith('-')
  return (
    <Td className={cx('text-right tabular-nums whitespace-nowrap', bold && 'font-semibold', negative && 'text-red-700', className)}>
      {formatMoney(value, { blankZero: !showZero })}
    </Td>
  )
}

export const rowClass = 'hover:bg-blue-50/50'
export const selectedRowClass = 'bg-blue-100/70'
