import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cx } from './button'

export const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ' +
  'disabled:bg-gray-100 disabled:text-gray-500 read-only:bg-gray-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cx(inputClass, className)} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cx(inputClass, className)} {...props} />
  },
)

export function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string
  children: ReactNode
  className?: string
  hint?: string
}) {
  return (
    <label className={cx('flex flex-col gap-1 text-sm', className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </label>
  )
}

export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" className="h-4 w-4 rounded border-gray-300" {...props} />
      {label}
    </label>
  )
}
