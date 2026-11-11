'use client'

import { useState } from 'react'
import { isIsoDate, isPeriod, lastDayOfPeriod, type Entry, type Period } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Alert, Dialog } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/form'
import { defaultDate } from './draft'

// "Copiar": a new borrador with the same lines, in the chosen month and date.
export function CopyDialog({
  entry, period: initialPeriod, pending, error, onCopy, onClose,
}: {
  entry: Entry
  period: Period
  pending: boolean
  error: unknown
  onCopy: (target: { period: Period; date: string }) => void
  onClose: () => void
}) {
  const [period, setPeriod] = useState(initialPeriod)
  const [date, setDate] = useState(defaultDate(initialPeriod))
  const valid = isPeriod(period) && isIsoDate(date) && date.startsWith(`${period}-`)

  function submit() {
    if (valid && !pending) onCopy({ period, date })
  }

  return (
    <Dialog
      open
      title={`Copiar partida ${entry.entryTypeCode}-${entry.number}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!valid || pending} onClick={submit}>Copiar</Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <p className="text-sm text-gray-600">Se crea una partida en borrador con las mismas líneas y el siguiente número.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mes destino">
            <Input
              type="month"
              autoFocus
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value)
                if (isPeriod(e.target.value)) setDate(defaultDate(e.target.value))
              }}
            />
          </Field>
          <Field label="Fecha" hint={!valid && isPeriod(period) ? 'La fecha debe estar dentro del mes destino.' : undefined}>
            <Input
              type="date"
              value={date}
              min={isPeriod(period) ? `${period}-01` : undefined}
              max={isPeriod(period) ? lastDayOfPeriod(period) : undefined}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        {error != null && <Alert>{errorMessage(error)}</Alert>}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  )
}
