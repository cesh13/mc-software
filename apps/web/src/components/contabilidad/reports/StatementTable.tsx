'use client'

import type { ReactNode } from 'react'
import type { StatementRow } from '@accounting/shared'
import { cx } from '@/components/ui/button'
import { MoneyTd, Table, Td, Th } from '@/components/ui/table'
import { totalRowClass } from './ReportFrame'
import { indentStyle } from './params'

// Indented account tree with subtotals by level (parent rows already carry rolled-up
// balances). `level` hides deeper accounts. Children are extra <tr> rows appended before nothing:
// use StatementLine / StatementTotal for them.
export function StatementTable({
  title,
  rows,
  level,
  total,
  totalLabel,
  children,
}: {
  title: string
  rows: StatementRow[]
  level: number | null
  total?: string
  totalLabel?: string
  children?: ReactNode
}) {
  const shown = level === null ? rows : rows.filter((r) => r.level <= level)
  return (
    <div className="break-inside-avoid">
      <Table>
        <thead>
          <tr>
            <Th>{title}</Th>
            <Th className="text-right">Saldo</Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.accountId}>
              <Td className={cx(!r.isDetail && 'font-bold')} style={indentStyle(r.level)}>
                <span className="mr-2 font-mono text-xs text-gray-500">{r.code}</span>
                {r.name}
              </Td>
              <MoneyTd value={r.balance} bold={!r.isDetail} />
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <Td colSpan={2} className="text-gray-500">
                Sin saldos.
              </Td>
            </tr>
          )}
          {children}
          {total !== undefined && <StatementTotal label={totalLabel ?? `Total ${title}`} value={total} />}
        </tbody>
      </Table>
    </div>
  )
}

export function StatementLine({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <Td className="italic">{label}</Td>
      <MoneyTd value={value} showZero />
    </tr>
  )
}

export function StatementTotal({ label, value }: { label: string; value: string }) {
  return (
    <tr className={totalRowClass}>
      <Td>{label}</Td>
      <MoneyTd value={value} bold showZero />
    </tr>
  )
}
