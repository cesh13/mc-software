'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTH_NAMES, type Period } from '@accounting/shared'
import { cx } from './button'

// ENERO … DICIEMBRE buttons with a year stepper, like the legacy "mes de trabajo".
export function MonthPicker({
  value,
  onChange,
  closed,
}: {
  value: Period
  onChange: (period: Period) => void
  // Periods ('AAAA-MM') to mark as closed.
  closed?: ReadonlySet<string>
}) {
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const set = (y: number, m: number) => onChange(`${y}-${String(m).padStart(2, '0')}`)

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div className="flex items-center rounded-md border border-gray-300 bg-white">
        <button aria-label="Año anterior" className="p-1.5 hover:bg-gray-100" onClick={() => set(year - 1, month)}>
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-sm font-semibold tabular-nums">{year}</span>
        <button aria-label="Año siguiente" className="p-1.5 hover:bg-gray-100" onClick={() => set(year + 1, month)}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {MONTH_NAMES.map((name, i) => {
          const period = `${year}-${String(i + 1).padStart(2, '0')}`
          const active = i + 1 === month
          return (
            <button
              key={name}
              onClick={() => set(year, i + 1)}
              aria-pressed={active}
              title={closed?.has(period) ? `${name} (cerrado)` : name}
              className={cx(
                'rounded border px-2 py-1 text-[11px] font-semibold tracking-wide',
                active ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                !active && closed?.has(period) && 'text-gray-400 line-through',
              )}
            >
              {name.slice(0, 3)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
