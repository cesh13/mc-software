'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isIsoDate, lastDayOfPeriod, periodLabel, type AnnualClosePreview as Preview, type Entry } from '@accounting/shared'
import { apiFetch, errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { useCurrentUser } from '@/lib/session'
import { useWorkPeriod } from '@/lib/work-period'
import { Button } from '@/components/ui/button'
import { Alert, ConfirmDialog, PageHeader } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/form'
import { AccountPicker } from '../AccountPicker'
import { AnnualClosePreview } from './AnnualClosePreview'
import { PrintHeader } from './ReportFrame'
import { GL_API, reportKeys, useEntryTypes, useFiscalYearOf } from './api'

export function AnnualCloseScreen() {
  const { empresa } = useEmpresa()
  const { can } = useCurrentUser()
  const qc = useQueryClient()
  const [work] = useWorkPeriod()
  const [year, setYear] = useState(work.slice(0, 4))
  const [entryTypeId, setEntryTypeId] = useState('')
  const [resultAccountId, setResultAccountId] = useState<string | null>(null)
  const [dateText, setDateText] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [created, setCreated] = useState<Entry | null>(null)

  // The fiscal year is the one that contains December of the typed year (assumption).
  const yearOk = /^\d{4}$/.test(year)
  const period = `${yearOk ? year : work.slice(0, 4)}-12`
  const fiscalYear = useFiscalYearOf(period)
  const types = useEntryTypes()
  const fy = fiscalYear.data
  const date = dateText ?? (fy ? lastDayOfPeriod(fy.endPeriod) : '')
  const ready = yearOk && !!fy && !!entryTypeId && !!resultAccountId && isIsoDate(date)
  const body = { period, entryTypeId, resultAccountId, date }

  const reset = () => {
    setPreview(null)
    setCreated(null)
    previewM.reset()
    applyM.reset()
  }
  const previewM = useMutation({
    mutationFn: () => apiFetch<Preview>(`${GL_API}/annual-close/preview`, { json: body }),
    onSuccess: setPreview,
  })
  const applyM = useMutation({
    mutationFn: () => apiFetch<Entry>(`${GL_API}/annual-close/apply`, { json: body }),
    onSuccess: (entry) => {
      setCreated(entry)
      setPreview(null)
      void qc.invalidateQueries({ queryKey: reportKeys.report })
      void qc.invalidateQueries({ queryKey: reportKeys.periods })
    },
    onSettled: () => setConfirm(false),
  })

  if (!can('supervise')) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Cierre anual" subtitle={empresa.name} />
        <Alert kind="warning">No tiene permiso para realizar el cierre anual.</Alert>
      </div>
    )
  }
  const canApply = !!preview && !preview.alreadyClosed && preview.lines.length > 0
  return (
    <div className="max-w-5xl">
      <PrintHeader title="Cierre anual: vista previa" range={preview ? `Ejercicio ${preview.fiscalYear.name}` : ''} />
      <PageHeader title="Cierre anual" subtitle={empresa.name} />
      <div className="mb-4 grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2 print:hidden">
        <Field label="Año fiscal" hint={fy ? `${periodLabel(fy.startPeriod)} a ${periodLabel(fy.endPeriod)}` : undefined}>
          <Input
            inputMode="numeric"
            maxLength={4}
            value={year}
            onChange={(e) => {
              setYear(e.target.value)
              setDateText(null)
              reset()
            }}
          />
        </Field>
        <Field label="Tipo de partida">
          <Select
            value={entryTypeId}
            onChange={(e) => {
              setEntryTypeId(e.target.value)
              reset()
            }}
          >
            <option value="">Seleccione…</option>
            {types.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} - {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cuenta de utilidad o pérdida">
          <AccountPicker
            detailOnly
            value={resultAccountId}
            onChange={(a) => {
              setResultAccountId(a?.id ?? null)
              reset()
            }}
          />
        </Field>
        <Field label="Fecha">
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDateText(e.target.value)
              reset()
            }}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button variant="primary" disabled={!ready || previewM.isPending} onClick={() => previewM.mutate()}>
            Vista previa
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {!!fiscalYear.error && <Alert>{errorMessage(fiscalYear.error)}</Alert>}
        {!!previewM.error && <Alert>{errorMessage(previewM.error)}</Alert>}
        {!!applyM.error && <Alert>{errorMessage(applyM.error)}</Alert>}
        {created && (
          <Alert kind="success">
            Cierre aplicado. Se creó la partida {created.entryTypeCode}-{created.number}.{' '}
            <Link className="font-medium underline" href={`/contabilidad/partidas?id=${created.id}`}>
              Abrir partida
            </Link>
          </Alert>
        )}
        {preview && (
          <>
            <AnnualClosePreview preview={preview} />
            <div className="flex gap-2 print:hidden">
              <Button variant="primary" disabled={!canApply || applyM.isPending} onClick={() => setConfirm(true)}>
                Aplicar cierre
              </Button>
              <Button onClick={() => window.print()}>Imprimir</Button>
            </div>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        danger
        title="Aplicar cierre anual"
        confirmLabel="Aplicar cierre"
        message={
          preview
            ? `Se grabará la partida de cierre ${preview.number} del ejercicio ${preview.fiscalYear.name} con fecha del ${preview.date.split('-').reverse().join('/')}. Cancela los saldos de ingresos y gastos contra la cuenta de utilidad o pérdida.`
            : ''
        }
        onConfirm={() => applyM.mutate()}
        onClose={() => setConfirm(false)}
      />
    </div>
  )
}
