'use client'

import { memo } from 'react'
import { Trash2 } from 'lucide-react'
import type { Account, CostCenter } from '@accounting/shared'
import { cx } from '@/components/ui/button'
import { inputClass } from '@/components/ui/form'
import { MoneyInput } from '@/components/ui/money-input'
import { AccountPicker } from '../AccountPicker'
import type { LineDraft } from './draft'

// Grid columns, in keyboard order. Cells carry data-r / data-c for EntryLinesGrid's navigation.
export const COL = { account: 0, costCenter: 1, detail: 2, debit: 3, credit: 4 } as const

const cell = 'border-b border-gray-100 px-1 py-0.5 align-top'
const compact = 'px-1.5 py-1'

type Props = {
  line: LineDraft
  index: number
  account: Account | undefined
  costCenters: CostCenter[]
  onAccount: (key: string, account: Account | null) => void
  onPatch: (key: string, patch: Partial<Pick<LineDraft, 'costCenterId' | 'detail' | 'debit' | 'credit'>>) => void
  onRemove: (key: string, index: number) => void
}

// One editable line. Memoized: typing in a line re-renders only that line.
export const EntryLineRow = memo(function EntryLineRow({
  line, index, account, costCenters, onAccount, onPatch, onRemove,
}: Props) {
  const n = index + 1
  const needsCenter = !!account?.requiresCostCenter
  const centerOptions = costCenters.filter((c) => c.isActive || c.id === line.costCenterId)

  return (
    <tr className="hover:bg-blue-50/40">
      <td className={cx(cell, 'pt-2 text-right text-xs tabular-nums text-gray-500')}>{n}</td>
      {/* The picker's own name line is hidden: the next column shows the name. */}
      <td className={cx(cell, '[&_p]:hidden [&_ul]:min-w-[28rem]')} data-r={index} data-c={COL.account}>
        <AccountPicker
          value={line.accountId}
          detailOnly
          ariaLabel={`Cuenta, línea ${n}`}
          onChange={(a) => onAccount(line.key, a)}
        />
      </td>
      <td className={cx(cell, 'pt-2 text-sm')}>
        <span className="line-clamp-2">{account?.name ?? ''}</span>
        {account && !account.isActive && <span className="text-xs italic text-red-700"> (inactiva)</span>}
      </td>
      <td className={cell} data-r={index} data-c={COL.costCenter}>
        <select
          aria-label={`Centro de costo, línea ${n}`}
          className={cx(inputClass, compact)}
          disabled={!needsCenter}
          value={needsCenter ? line.costCenterId : ''}
          onChange={(e) => onPatch(line.key, { costCenterId: e.target.value })}
        >
          <option value="">{needsCenter ? '(elegir)' : ''}</option>
          {needsCenter &&
            centerOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
        </select>
      </td>
      <td className={cell} data-r={index} data-c={COL.detail}>
        <input
          aria-label={`Detalle, línea ${n}`}
          className={cx(inputClass, compact)}
          maxLength={200}
          value={line.detail}
          onChange={(e) => onPatch(line.key, { detail: e.target.value })}
        />
      </td>
      <td className={cell} data-r={index} data-c={COL.debit}>
        <MoneyInput
          aria-label={`Cargo, línea ${n}`}
          className={compact}
          value={line.debit}
          onChange={(v) => onPatch(line.key, { debit: v })}
        />
      </td>
      <td className={cell} data-r={index} data-c={COL.credit}>
        <MoneyInput
          aria-label={`Abono, línea ${n}`}
          className={compact}
          value={line.credit}
          onChange={(v) => onPatch(line.key, { credit: v })}
        />
      </td>
      <td className={cx(cell, 'pt-1.5')}>
        <button
          type="button"
          tabIndex={-1}
          title="Eliminar línea (Ctrl+Supr)"
          aria-label={`Eliminar línea ${n}`}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-700"
          onClick={() => onRemove(line.key, index)}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
})
