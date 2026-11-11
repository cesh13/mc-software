'use client'

import { forwardRef, type KeyboardEvent, type ReactNode } from 'react'
import { lastDayOfPeriod, type Entry, type EntryType, type Period } from '@accounting/shared'
import { cx } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/form'
import { FIELD_IDS } from './grid-focus'

export type HeaderValues = { entryTypeId: string; number: string; date: string; concept: string }

type Props = {
  values: HeaderValues
  editing: boolean
  period: Period
  types: EntryType[]
  numberEditable: boolean
  numberHint?: string
  onChange: (patch: Partial<HeaderValues>) => void
  onEditNumber: () => void
  // Enter on the last header field (Concepto): move into the grid.
  onDone: () => void
  badges?: ReactNode
}

// Tipo · Número · Fecha · Concepto. Enter moves to the next field, as in the legacy form.
// The ref points at the Tipo select (first field when adding).
export const EntryHeader = forwardRef<HTMLSelectElement, Props>(function EntryHeader(p, typeRef) {
  const { values: v, editing } = p
  const options = p.types.filter((t) => t.isActive || t.id === v.entryTypeId)
  const current = p.types.find((t) => t.id === v.entryTypeId)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' || !editing) return
    const fields = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-h]'))
    const i = fields.indexOf(e.target as HTMLElement)
    if (i < 0) return
    e.preventDefault()
    const next = fields[i + 1]
    if (next) next.focus()
    else p.onDone()
  }

  return (
    <div className="grid grid-cols-[14rem_10rem_10rem_1fr_auto] items-start gap-3 max-lg:grid-cols-2" onKeyDown={onKeyDown}>
      <Field label="Tipo">
        {editing ? (
          <Select ref={typeRef} id={FIELD_IDS.type} data-h value={v.entryTypeId} onChange={(e) => p.onChange({ entryTypeId: e.target.value })}>
            {options.length === 0 && <option value="">(sin tipos)</option>}
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </Select>
        ) : (
          <Input readOnly value={current ? `${current.code} — ${current.name}` : ''} />
        )}
      </Field>
      <Field label="Número" hint={editing ? p.numberHint : undefined}>
        <div className="flex items-center gap-1">
          <Input
            {...(editing && p.numberEditable ? { 'data-h': true } : {})}
            id={FIELD_IDS.number}
            readOnly={!editing || !p.numberEditable}
            inputMode="numeric"
            maxLength={10}
            className="font-mono tabular-nums"
            value={v.number}
            onChange={(e) => p.onChange({ number: e.target.value.replace(/\D/g, '') })}
          />
          {editing && !p.numberEditable && (
            <button type="button" className="text-xs text-blue-700 hover:underline" onClick={p.onEditNumber}>
              editar
            </button>
          )}
        </div>
      </Field>
      <Field label="Fecha">
        <Input
          data-h
          id={FIELD_IDS.date}
          type="date"
          readOnly={!editing}
          min={`${p.period}-01`}
          max={lastDayOfPeriod(p.period)}
          value={v.date}
          onChange={(e) => p.onChange({ date: e.target.value })}
        />
      </Field>
      <Field label="Concepto">
        <Input
          data-h
          readOnly={!editing}
          maxLength={120}
          value={v.concept}
          onChange={(e) => p.onChange({ concept: e.target.value })}
        />
      </Field>
      <div className={cx('flex flex-wrap gap-1 pt-5', !p.badges && 'hidden')}>{p.badges}</div>
    </div>
  )
})

const SOURCE_LABELS: Record<string, string> = { importado: 'Importada', bancos: 'Bancos', iva: 'IVA', cierre: 'Cierre' }

function Badge({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'gray' | 'blue'; children: ReactNode }) {
  const styles = {
    green: 'border-green-200 bg-green-50 text-green-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-800',
    gray: 'border-gray-200 bg-gray-50 text-gray-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
  }[tone]
  return <span className={cx('rounded border px-2 py-0.5 text-xs font-semibold', styles)}>{children}</span>
}

export function EntryBadges({ entry, editing }: { entry: Pick<Entry, 'status' | 'source' | 'isActive' | 'importedUnbalanced'> | null; editing: boolean }) {
  return (
    <>
      {editing && <Badge tone="blue">{entry ? 'Modificando' : 'Nueva'}</Badge>}
      {entry && (
        <Badge tone={entry.status === 'aplicada' ? 'green' : 'amber'}>
          {entry.status === 'aplicada' ? 'Aplicada' : 'Borrador'}
        </Badge>
      )}
      {entry && SOURCE_LABELS[entry.source] && <Badge tone="gray">{SOURCE_LABELS[entry.source]}</Badge>}
      {entry?.importedUnbalanced && <Badge tone="red">Descuadrada</Badge>}
      {entry && !entry.isActive && <Badge tone="red">Anulada</Badge>}
    </>
  )
}
