'use client'

import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react'
import { cx } from './button'
import { inputClass } from './form'
import { formatMoney, parseMoneyInput } from '@/lib/format'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  // Exact decimal string, e.g. '1234.50'.
  value: string
  onChange: (value: string) => void
}

// Amount field: shows '1,234.50', edits as plain text, never uses floats.
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onChange, className, onBlur, onFocus, ...props },
  ref,
) {
  const [text, setText] = useState(formatMoney(value, { blankZero: true }))
  const [focused, setFocused] = useState(false)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (!focused) setText(formatMoney(value, { blankZero: true }))
  }, [value, focused])

  return (
    <input
      ref={ref}
      inputMode="decimal"
      className={cx(inputClass, 'text-right tabular-nums', invalid && 'border-red-500 ring-1 ring-red-500', className)}
      value={text}
      aria-invalid={invalid}
      onFocus={(e) => {
        setFocused(true)
        e.target.select()
        onFocus?.(e)
      }}
      onChange={(e) => {
        setText(e.target.value)
        const parsed = parseMoneyInput(e.target.value)
        setInvalid(parsed === null)
        if (parsed !== null) onChange(parsed)
      }}
      onBlur={(e) => {
        setFocused(false)
        setInvalid(false)
        onBlur?.(e)
      }}
      {...props}
    />
  )
})
