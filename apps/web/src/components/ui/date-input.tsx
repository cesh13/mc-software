'use client'

import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { CalendarDays } from 'lucide-react'
import { MONTH_NAMES } from '@accounting/shared'
import { cx } from './button'
import { inputClass, Select } from './form'

// Dates always read dd/mm/aaaa, whatever the computer's region is. The value
// in and out stays ISO ('AAAA-MM-DD'); '' while the text is not a full date.

const pad = (n: number) => String(n).padStart(2, '0')

export function isoToDmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

export function dmyToIso(text: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim())
  if (!m) return ''
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return ''
  return `${y}-${pad(mo)}-${pad(d)}`
}

// Typing digits only fills in the slashes: 03042026 → 03/04/2026.
function mask(raw: string): string {
  if (raw.includes('/')) return raw.replace(/[^\d/]/g, '').slice(0, 10)
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/')
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
}

export const DateInput = forwardRef<HTMLInputElement, Props>(function DateInput(
  { value, onChange, min, max, className, readOnly, disabled, onBlur, ...props },
  ref,
) {
  const [text, setText] = useState(() => isoToDmy(value))
  const pickerRef = useRef<HTMLInputElement>(null)

  // Follow outside changes (a new period, a reset) without fighting the user's typing.
  useEffect(() => {
    if (dmyToIso(text) !== value) setText(isoToDmy(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const locked = readOnly || disabled

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        autoComplete="off"
        className={cx(inputClass, 'pr-8 tabular-nums', className)}
        value={text}
        readOnly={readOnly}
        disabled={disabled}
        onChange={(e) => {
          const next = mask(e.target.value)
          setText(next)
          const iso = dmyToIso(next)
          if (iso !== value) onChange(iso)
        }}
        onBlur={(e) => {
          const iso = dmyToIso(text)
          if (iso) setText(isoToDmy(iso))
          onBlur?.(e)
        }}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Abrir calendario"
        disabled={locked}
        className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 hover:text-gray-800 disabled:opacity-40"
        onClick={() => pickerRef.current?.showPicker?.()}
      >
        <CalendarDays size={16} />
      </button>
      {/* Native calendar popup only; the visible field is the text box above. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          setText(isoToDmy(e.target.value))
          onChange(e.target.value)
        }}
      />
    </div>
  )
})

function years(selected: number): number[] {
  const now = new Date().getFullYear()
  const from = Math.min(2000, selected)
  const to = Math.max(now + 2, selected)
  return Array.from({ length: to - from + 1 }, (_, i) => to - i)
}

// Month + year chooser that reads in Spanish on any machine. Value is 'AAAA-MM'.
export function PeriodInput({
  value, onChange, autoFocus,
}: {
  value: string
  onChange: (period: string) => void
  autoFocus?: boolean
}) {
  const year = Number(value.slice(0, 4)) || new Date().getFullYear()
  const month = Number(value.slice(5, 7)) || 1
  const set = (y: number, m: number) => onChange(`${y}-${pad(m)}`)
  return (
    <div className="flex gap-2">
      <Select autoFocus={autoFocus} value={month} onChange={(e) => set(year, Number(e.target.value))}>
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={i + 1}>{name.charAt(0) + name.slice(1).toLowerCase()}</option>
        ))}
      </Select>
      <Select className="w-24 tabular-nums" value={year} onChange={(e) => set(Number(e.target.value), month)}>
        {years(year).map((y) => <option key={y} value={y}>{y}</option>)}
      </Select>
    </div>
  )
}
