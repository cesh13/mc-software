'use client'

import { useState, type KeyboardEvent } from 'react'
import { errorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Alert, Dialog } from '@/components/ui/feedback'
import { Checkbox, Field, Input, Select } from '@/components/ui/form'
import { AccountPicker } from '@/components/contabilidad/AccountPicker'

// A small maintenance dialog described by its fields (bodegas, grupos, tipos, productos).
export type FormField =
  | { key: string; label: string; kind: 'text'; maxLength: number; upper?: boolean; required?: boolean; mono?: boolean; span?: 2 }
  | { key: string; label: string; kind: 'select'; options: { value: string; label: string }[]; disabledOnEdit?: boolean; span?: 2 }
  | { key: string; label: string; kind: 'account'; hint?: string; span?: 2 }
  | { key: string; label: string; kind: 'check'; disabledOnEdit?: boolean; span?: 2 }

type Values = Record<string, string | boolean | null>

export function FormDialog(p: {
  title: string
  fields: FormField[]
  initial: Values
  editing: boolean
  saving: boolean
  error: unknown
  onSave: (values: Values) => Promise<void>
  onClose: () => void
}) {
  const [values, setValues] = useState<Values>(p.initial)
  const [localError, setLocalError] = useState<string | null>(null)
  const set = (key: string, v: string | boolean | null) => setValues((cur) => ({ ...cur, [key]: v }))

  async function save() {
    if (p.saving) return
    const missing = p.fields.find((f) => f.kind === 'text' && f.required && !String(values[f.key] ?? '').trim())
    if (missing) return setLocalError(`Escriba ${missing.label.toLowerCase()}.`)
    setLocalError(null)
    const clean: Values = {}
    for (const f of p.fields) {
      const v = values[f.key]
      clean[f.key] = typeof v === 'string' ? (v.trim() === '' && f.kind !== 'select' ? null : v.trim()) : v ?? null
    }
    try {
      await p.onSave(clean)
    } catch {
      // Shown below.
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'F10') {
      e.preventDefault()
      void save()
    }
  }

  return (
    <Dialog
      open
      wide
      title={p.title}
      onClose={p.onClose}
      footer={
        <>
          <Button onClick={p.onClose}>Cancelar (Esc)</Button>
          <Button variant="primary" disabled={p.saving} onClick={() => void save()}>Grabar (F10)</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3" onKeyDown={onKeyDown}>
        {p.fields.map((f, n) => {
          const cls = f.span === 2 ? 'col-span-2' : undefined
          const locked = 'disabledOnEdit' in f && f.disabledOnEdit && p.editing
          if (f.kind === 'check') {
            return (
              <div key={f.key} className={cls ?? 'col-span-2'}>
                <Checkbox label={f.label} checked={!!values[f.key]} disabled={locked} onChange={(e) => set(f.key, e.target.checked)} />
              </div>
            )
          }
          return (
            <Field key={f.key} label={f.label} className={cls} hint={f.kind === 'account' ? f.hint : undefined}>
              {f.kind === 'text' && (
                <Input
                  autoFocus={n === 0}
                  value={String(values[f.key] ?? '')}
                  maxLength={f.maxLength}
                  className={f.mono || f.upper ? 'font-mono uppercase' : undefined}
                  onChange={(e) => set(f.key, f.upper ? e.target.value.toUpperCase() : e.target.value)}
                />
              )}
              {f.kind === 'select' && (
                <Select value={String(values[f.key] ?? '')} disabled={locked} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              )}
              {f.kind === 'account' && (
                <AccountPicker detailOnly value={(values[f.key] as string | null) ?? null} onChange={(a) => set(f.key, a?.id ?? null)} ariaLabel={f.label} />
              )}
            </Field>
          )
        })}
        {(localError || p.error != null) && <div className="col-span-2"><Alert>{localError ?? errorMessage(p.error)}</Alert></div>}
      </div>
    </Dialog>
  )
}
