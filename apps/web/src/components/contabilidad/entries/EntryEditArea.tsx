'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Entry, EntryType, Period } from '@accounting/shared'
import { EntryBadges, EntryHeader } from './EntryHeader'
import { EntryLinesGrid } from './EntryLinesGrid'
import { EntryLinesView } from './EntryLinesView'
import { COL } from './EntryLineRow'
import { TotalsBar } from './TotalsBar'
import { focusTarget, LINES_ID } from './grid-focus'
import type { EntryEditor } from './use-entry-editor'
import { useNextNumber } from './use-entries'

const noop = () => {}

// Edición: header fields + editable grid + live totals.
export function EntryEditArea({
  editor, entry, period, types, onGridBusy,
}: {
  editor: EntryEditor
  // The entry being modified (null while adding).
  entry: Entry | null
  period: Period
  types: EntryType[]
  onGridBusy: (busy: boolean) => void
}) {
  const d = editor.draft
  const adding = !!d && d.id === null
  const preview = useNextNumber(period, d?.entryTypeId ?? '', adding && !d?.numberEdited)
  const typeRef = useRef<HTMLSelectElement>(null)
  const { header } = editor
  const onDone = useCallback(() => focusTarget({ r: 0, c: COL.account }), [])
  const firstActive = types.find((t) => t.isActive)?.id
  // Agregar pressed before the types arrived: take the first active type once they do.
  useEffect(() => {
    if (adding && !d?.entryTypeId && firstActive) header({ entryTypeId: firstActive })
  }, [adding, d?.entryTypeId, firstActive, header])
  if (!d) return null

  const number = d.numberEdited || !adding ? d.number : preview.data?.number ?? ''
  const typeChanged = !adding && entry && entry.entryTypeId !== d.entryTypeId
  const hint = adding
    ? d.numberEdited ? 'Si ya está asignado se usa el siguiente.' : 'Tentativo; se confirma al grabar.'
    : typeChanged ? 'Con otro tipo puede cambiar el número.' : undefined

  return (
    <div className="flex flex-col gap-3">
      {adding && types.length > 0 && !firstActive && (
        <p className="text-sm text-red-700">No hay tipos de partida activos. Créelos en Tipos de partida.</p>
      )}
      <EntryHeader
        ref={typeRef}
        values={{ entryTypeId: d.entryTypeId, number, date: d.date, concept: d.concept }}
        editing
        period={period}
        types={types}
        numberEditable={d.numberEdited}
        numberHint={hint}
        onChange={header}
        onEditNumber={() => {
          header({ numberEdited: true, number })
          setTimeout(() => focusTarget({ field: 'number' }), 0)
        }}
        onDone={onDone}
        badges={<EntryBadges entry={entry && !adding ? entry : null} editing />}
      />
      <div id={LINES_ID}>
        <EntryLinesGrid editor={editor} onBusy={onGridBusy} />
      </div>
      <TotalsBar debit={editor.totals.debit} credit={editor.totals.credit} difference={editor.totals.difference} />
      <p className="text-xs text-gray-500 print:hidden">
        Enter: siguiente campo · Enter al final de la última línea: nueva línea · Ctrl+Supr: eliminar línea · F10: grabar · Esc: cancelar
      </p>
    </div>
  )
}

// Consulta: the same header, read-only, and the stored lines.
export function EntryViewArea({ entry, types, period }: { entry: Entry; types: EntryType[]; period: Period }) {
  return (
    <div className="flex flex-col gap-3">
      <EntryHeader
        values={{ entryTypeId: entry.entryTypeId, number: entry.number, date: entry.date, concept: entry.concept }}
        editing={false}
        period={period}
        types={types}
        numberEditable={false}
        onChange={noop}
        onEditNumber={noop}
        onDone={noop}
        badges={<EntryBadges entry={entry} editing={false} />}
      />
      <EntryLinesView lines={entry.lines} />
      <TotalsBar debit={entry.totals.debit} credit={entry.totals.credit} difference={entry.totals.difference} />
    </div>
  )
}
