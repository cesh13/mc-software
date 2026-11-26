'use client'

import { useState } from 'react'
import type { ImportResult } from '@accounting/shared'
import { apiFetch, errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { Button } from '@/components/ui/button'
import { Alert, PageHeader } from '@/components/ui/feedback'
import { Field, Select } from '@/components/ui/form'
import { DateInput, dmyToIso } from '@/components/ui/date-input'
import { todayIso } from './format'
import { INV_API, useCatalog, useInvMutation } from './use-inventory'

type Kind = 'items' | 'opening'
const COLUMNS: Record<Kind, string> = {
  items: 'Código · Descripción · Grupo · Unidad · Lotes (S/N) · Servicio (S/N)',
  opening: 'Código · Bodega · Cantidad · Costo unitario · Lote · Vence (dd/mm/aaaa)',
}

const yes = (v?: string) => /^(s|si|sí|x|1|true)$/i.test((v ?? '').trim())
const cells = (text: string) => text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/\t|;/))

function rowsOf(kind: Kind, text: string) {
  return cells(text).map((c) => kind === 'items'
    ? { code: c[0] ?? '', name: c[1] ?? '', groupCode: c[2] || undefined, unit: c[3] || undefined, tracksLots: yes(c[4]), isService: yes(c[5]) }
    : { itemCode: c[0] ?? '', warehouseCode: c[1] ?? '', quantity: c[2] ?? '', unitCost: c[3] ?? '', lotNo: c[4] || undefined, expiresOn: c[5] ? dmyToIso(c[5]) || c[5] : undefined })
}

// Carga de productos e inventario inicial pegando filas desde Excel. Todo o nada.
export function ImportScreen() {
  const { empresa } = useEmpresa()
  const types = useCatalog('movement-types')
  const [kind, setKind] = useState<Kind>('items')
  const [text, setText] = useState('')
  const [typeId, setTypeId] = useState('')
  const [date, setDate] = useState(todayIso())
  const [result, setResult] = useState<ImportResult | null>(null)
  const run = useInvMutation((dryRun: boolean) => apiFetch<ImportResult>(`${INV_API}/imports/${kind}`, {
    json: kind === 'items' ? { rows: rowsOf(kind, text), dryRun } : { rows: rowsOf(kind, text), dryRun, typeId, date },
  }))
  const go = async (dryRun: boolean) => {
    setResult(null)
    try { setResult(await run.mutateAsync(dryRun)) } catch { /* shown below */ }
  }
  const count = cells(text).length
  return (
    <div className="max-w-4xl">
      <PageHeader title="Importar a inventario" subtitle={empresa.name} />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Qué importa">
          <Select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setResult(null) }}>
            <option value="items">Productos</option>
            <option value="opening">Inventario inicial</option>
          </Select>
        </Field>
        {kind === 'opening' && (
          <>
            <Field label="Tipo de movimiento">
              <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">Elija…</option>
                {(types.data ?? []).filter((t) => t.kind === 'inicial').map((t) => <option key={t.id} value={t.id}>{t.code} - {t.name}</option>)}
              </Select>
            </Field>
            <Field label="Fecha de corte"><DateInput value={date} onChange={setDate} /></Field>
          </>
        )}
      </div>
      <Field label={`Pegue las filas desde Excel (sin encabezado): ${COLUMNS[kind]}`}>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null) }} rows={14} spellCheck={false}
          className="w-full rounded-md border border-gray-300 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
      <div className="mt-3 flex items-center gap-2">
        <Button disabled={!count || run.isPending} onClick={() => void go(true)}>Revisar ({count} filas)</Button>
        <Button variant="primary" disabled={!count || run.isPending || !result?.dryRun || result.problems.length > 0} onClick={() => void go(false)}>Importar</Button>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {run.error != null && <Alert>{errorMessage(run.error)}</Alert>}
        {result && result.problems.length > 0 && (
          <Alert>
            {result.problems.length} filas con problemas (no se importó nada):
            <ul className="mt-1 list-disc pl-5">{result.problems.slice(0, 50).map((p) => <li key={p.row}>Fila {p.row}: {p.message}</li>)}</ul>
          </Alert>
        )}
        {result?.dryRun && !result.problems.length && <Alert kind="info">{result.accepted} filas correctas. Presione Importar para grabarlas.</Alert>}
        {result && !result.dryRun && !result.problems.length && (
          <Alert kind="success">
            {kind === 'items' ? `Productos creados: ${result.created ?? 0}; actualizados: ${result.updated ?? 0}.` : `Se grabaron ${result.created ?? 0} movimientos de inventario inicial.`}
          </Alert>
        )}
      </div>
    </div>
  )
}
