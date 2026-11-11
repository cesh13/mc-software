'use client'

// AccountPicker: account lookup by code or name, shared by the catalog and the journal entry screen.
//
// Props:
//   value        string | null   selected account id
//   onChange     (account: Account | null) => void   called on pick, or with null when the text is cleared
//   detailOnly   only detail (postable) accounts
//   excludeDetail  only parent (non-detail) accounts
//   excludeId    hide one account (e.g. the account being edited, as its own parent)
//   autoFocus, disabled, inputRef, id (for an external <label htmlFor>), ariaLabel
//
// Only active accounts are offered. Typing an exact code and pressing Enter/Tab picks it.
// Enter on an open list picks the highlighted row (the event is consumed); Esc closes the list
// without reaching an enclosing Dialog. All pickers share the single `useAccounts()` query.

import { useEffect, useId, useMemo, useState, type KeyboardEvent, type Ref } from 'react'
import type { Account } from '@accounting/shared'
import { inputClass } from '@/components/ui/form'
import { cx } from '@/components/ui/button'
import { useAccounts } from './coa/use-coa'
import { searchAccounts } from './coa/search'

export type AccountPickerProps = {
  value: string | null
  onChange: (account: Account | null) => void
  detailOnly?: boolean
  excludeDetail?: boolean
  excludeId?: string
  autoFocus?: boolean
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
  id?: string
  ariaLabel?: string
}

export function AccountPicker(props: AccountPickerProps) {
  const { value, onChange, detailOnly, excludeDetail, excludeId, autoFocus, disabled, inputRef, ariaLabel } = props
  const { data, byId, isLoading, error } = useAccounts()
  const autoId = useId()
  const inputId = props.id ?? `${autoId}-input`
  const listId = `${autoId}-list`
  const selected = value ? byId.get(value) ?? null : null

  const [text, setText] = useState(selected?.code ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  // Show the picked account's code whenever the selection changes from outside.
  useEffect(() => setText(selected?.code ?? ''), [selected?.code])

  const matches = useMemo(
    () => (open && data ? searchAccounts(data, text, { detailOnly, excludeDetail, excludeId }) : []),
    [open, data, text, detailOnly, excludeDetail, excludeId],
  )

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, listId])

  function pick(account: Account) {
    setOpen(false)
    setText(account.code)
    if (account.id !== value) onChange(account)
  }

  // On leaving the field: an exact code is picked, anything else reverts to the current selection.
  function commit() {
    setOpen(false)
    const code = text.trim().toLowerCase()
    const exact = code && data ? searchAccounts(data, code, { detailOnly, excludeDetail, excludeId }, 1)[0] : undefined
    if (exact && exact.code.toLowerCase() === code) pick(exact)
    else setText(selected?.code ?? '')
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      const last = Math.max(matches.length - 1, 0)
      setActive((i) => Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), last))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      const hit = matches[active]
      if (hit) pick(hit)
      else commit()
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
      setText(selected?.code ?? '')
    }
  }

  return (
    <div className="relative">
      <input
        id={inputId}
        ref={inputRef}
        role="combobox"
        aria-label={props.id ? undefined : ariaLabel ?? 'Cuenta'}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        className={inputClass}
        value={text}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="off"
        placeholder="Código o nombre"
        onChange={(e) => {
          setText(e.target.value)
          setActive(0)
          setOpen(true)
          if (e.target.value === '' && value) onChange(null)
        }}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
      <p className="mt-0.5 min-h-[1rem] truncate text-xs text-gray-600">
        {isLoading ? 'Cargando cuentas…' : error ? 'No se pudo cargar el catálogo.' : selected?.name ?? ''}
      </p>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-0.5 max-h-56 overflow-auto rounded-md border border-gray-300 bg-white py-1 text-sm shadow-lg"
        >
          {matches.length === 0 && <li className="px-2.5 py-1.5 text-gray-500">Sin coincidencias</li>}
          {matches.map((a, i) => (
            <li
              key={a.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cx('flex cursor-pointer gap-3 px-2.5 py-1', i === active && 'bg-blue-100')}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(a)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="w-28 shrink-0 font-mono text-xs leading-5">{a.code}</span>
              <span className="truncate">{a.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
