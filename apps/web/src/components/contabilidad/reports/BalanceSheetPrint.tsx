'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MONTH_NAMES, addMoney, isZeroMoney,
  type BalanceSheet, type BalanceSignature, type StatementRow, type StatementSection,
} from '@accounting/shared'
import { apiFetch, errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { usePermissions } from '@/lib/permissions'
import { formatMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'

// Printed Balance General, as the legacy report (cgrbalg1): "Cuenta" puts Activo
// beside Pasivo y Capital, "Reporte" one under the other. Accounts without codes
// down to the chosen level; the deeper ones carry their amount in an inner column
// (parciales), level 2 in the outer one. Signatures come from the empresa setting.

type Format = 'cuenta' | 'reporte'
type Options = { format: Format; stamp: boolean }
const STORE = 'balance-sheet-print'
const DEFAULTS: Options = { format: 'cuenta', stamp: true }
const SIGNATURES_KEY = ['empresa-settings', 'gl']
const EMPTY_SIGNATURES: BalanceSignature[] = [0, 1, 2].map(() => ({ name: '', title: '' }))

function loadOptions(): Options {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<Options> | null
    if (saved && (saved.format === 'cuenta' || saved.format === 'reporte')) return { ...DEFAULTS, ...saved }
  } catch {
    // Storage unavailable: defaults.
  }
  return DEFAULTS
}

type SettingRow = { key: string; value: unknown }

function useSignatures() {
  const { empresa } = useEmpresa()
  return useQuery({
    queryKey: [...SIGNATURES_KEY, empresa.id],
    queryFn: async () => {
      const rows = await apiFetch<SettingRow[]>('/api/empresa-settings?namespace=gl')
      const saved = (rows.find((r) => r.key === 'balanceSignatures')?.value ?? []) as BalanceSignature[]
      return EMPTY_SIGNATURES.map((e, i) => saved[i] ?? e)
    },
  })
}

export function BalanceSheetPrint({ data, level }: { data: BalanceSheet; level: number }) {
  const { empresa } = useEmpresa()
  const [opts, setOpts] = useState<Options>(DEFAULTS)
  useEffect(() => setOpts(loadOptions()), [])
  const update = (next: Partial<Options>) => {
    const merged = { ...opts, ...next }
    setOpts(merged)
    try {
      localStorage.setItem(STORE, JSON.stringify(merged))
    } catch {
      // Not remembered.
    }
  }
  const signatures = useSignatures()
  // Cuenta is printed landscape, as the legacy report; Reporte portrait.
  const landscape = opts.format === 'cuenta'
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--sheet-width', landscape ? '11in' : '8.5in')
    root.setProperty('--sheet-height', landscape ? '8.5in' : '11in')
    return () => {
      root.removeProperty('--sheet-width')
      root.removeProperty('--sheet-height')
    }
  }, [landscape])
  const [stamp, setStamp] = useState('')
  useEffect(() => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    setStamp(`${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`)
  }, [])

  const month = MONTH_NAMES[Number(data.period.slice(5, 7)) - 1]
  const monthName = month.charAt(0) + month.slice(1).toLowerCase()
  const year = data.period.slice(0, 4)
  const left = sideRows([data.activo], level)
  const right = sideRows([data.pasivo, data.capital], level)
  const result = addMoney(data.currentYearResult, data.priorYearsResult)
  if (!isZeroMoney(data.priorYearsResult)) {
    right.push({ key: 'prior', name: 'RESULTADO DE EJERCICIOS ANTERIORES', outer: data.priorYearsResult, indent: 1 })
  }
  if (!isZeroMoney(data.currentYearResult)) {
    const loss = data.currentYearResult.startsWith('-')
    right.push({
      key: 'result', name: loss ? 'PÉRDIDA DEL EJERCICIO' : 'UTILIDAD DEL EJERCICIO',
      outer: data.currentYearResult, indent: 1,
    })
  }
  const totalRight = addMoney(data.pasivo.total, data.capital.total, result)
  const memo = [...data.orden.rows, ...data.contra.rows].filter((r) => r.level === 1 && !isZeroMoney(r.balance))

  return (
    <div className="hidden text-black print:block">
      <style>{`@page { size: letter ${landscape ? 'landscape' : 'portrait'}; margin: 0.5in; }`}</style>
      <OptionsPanel opts={opts} update={update} />
      <div className="text-[11px] leading-snug">
        {opts.stamp && <p className="text-[10px]">{stamp}</p>}
        <div className="mb-4 text-center">
          <p className="text-base font-bold">{empresa.name}</p>
          <p className="text-sm font-semibold">
            BALANCE GENERAL&nbsp;&nbsp; {data.saldos === 'mensual' ? 'Movimiento de ' : ''}{monthName} DEL {year}
          </p>
          <p className="text-sm font-semibold">EXPRESADO EN DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA</p>
        </div>
        {opts.format === 'cuenta' ? (
          <div className="grid grid-cols-2 gap-x-8">
            <SideTitle>A C T I V O</SideTitle>
            <SideTitle>P A S I V O &nbsp;Y&nbsp; C A P I T A L</SideTitle>
            <SideTable rows={left} />
            <SideTable rows={right} />
            <SideTotal label="Total de Activo" value={data.activo.total} />
            <SideTotal label="Total de Pasivo y Capital" value={totalRight} />
          </div>
        ) : (
          <div className="mx-auto max-w-[6.5in]">
            <SideTitle>A C T I V O</SideTitle>
            <SideTable rows={left} />
            <SideTotal label="Total de Activo" value={data.activo.total} />
            <div className="h-6" />
            <SideTitle>P A S I V O &nbsp;Y&nbsp; C A P I T A L</SideTitle>
            <SideTable rows={right} />
            <SideTotal label="Total de Pasivo y Capital" value={totalRight} />
          </div>
        )}
        {memo.length > 0 && (
          <div className="mt-4 max-w-[4in] text-[10px]">
            {memo.map((r) => (
              <div key={r.accountId} className="flex justify-between gap-4">
                <span>{r.name.toUpperCase()}</span>
                <span className="tabular-nums">{formatMoney(r.balance)}</span>
              </div>
            ))}
          </div>
        )}
        <Signatures list={signatures.data ?? []} />
      </div>
    </div>
  )
}

type Row = { key: string; name: string; inner?: string; outer?: string; indent: number; header?: boolean; close?: boolean }

// Rows of one side: level 2 with the amount outside, deeper levels with it inside.
// Level 1 (Activo, Pasivo, Capital) is the side's title, as in the legacy report.
function sideRows(sections: StatementSection[], level: number): Row[] {
  const rows: Row[] = []
  for (const s of sections) {
    const shown = s.rows.filter((r: StatementRow) => r.level >= 2 && r.level <= level && !isZeroMoney(r.balance))
    for (const r of shown) {
      const outer = r.level === 2 || level === 2
      rows.push({
        key: r.accountId, name: r.name.toUpperCase(), indent: r.level - 2, header: outer && level > 2,
        ...(outer ? { outer: r.balance } : { inner: r.balance }),
      })
    }
  }
  // A rule under the last parcial of each group.
  rows.forEach((r, i) => {
    if (r.inner !== undefined && rows[i + 1]?.inner === undefined) r.close = true
  })
  return rows
}

function SideTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-center text-[11px] font-semibold tracking-wide">
      <span className="border-b-[3px] border-double border-black px-6">{children}</span>
    </p>
  )
}

function SideTable({ rows }: { rows: Row[] }) {
  return (
    <table className="w-full self-start border-collapse">
      <colgroup>
        <col />
        <col className="w-24" />
        <col className="w-24" />
      </colgroup>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className={r.header ? '[&>td]:pt-2' : undefined}>
            <td className="py-0.5 pr-2" style={{ paddingLeft: `${Math.max(r.indent - 1, 0) * 10}px` }}>{r.name}</td>
            <td className={`py-0.5 text-right tabular-nums ${r.close ? 'border-b border-black' : ''}`}>
              {r.inner !== undefined ? formatMoney(r.inner) : ''}
            </td>
            <td className="py-0.5 pl-2 text-right tabular-nums">{r.outer !== undefined ? formatMoney(r.outer) : ''}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={3} className="py-1 text-gray-500">Sin saldos.</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

function SideTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-end justify-end gap-6 text-xs font-semibold">
      <span className="pb-1">{label}</span>
      <span className="w-28 border-t border-black pt-1 text-right tabular-nums">
        <span className="block border-b-[3px] border-double border-black pb-0.5">{formatMoney(value)}</span>
      </span>
    </div>
  )
}

// Legacy layout: first pair left, second right, third centered underneath.
function Signatures({ list }: { list: BalanceSignature[] }) {
  const [a, b, c] = list
  const one = (s: BalanceSignature | undefined) =>
    s && (s.name || s.title) ? (
      <div className="text-[10px] uppercase">
        <p>{s.name}</p>
        <p>{s.title}</p>
      </div>
    ) : null
  if (!list.some((s) => s.name || s.title)) return null
  return (
    <div className="mt-20 break-inside-avoid">
      <div className="flex justify-between px-16">
        <div>{one(a)}</div>
        <div>{one(b)}</div>
      </div>
      <div className="mt-8 flex justify-center">{one(c)}</div>
    </div>
  )
}

function OptionsPanel({ opts, update }: { opts: Options; update: (o: Partial<Options>) => void }) {
  return (
    <div className="preview-only mb-4 space-y-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="font-semibold text-gray-700">Formato:</span>
        {(['cuenta', 'reporte'] as const).map((f) => (
          <label key={f} className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="balance-format" checked={opts.format === f} onChange={() => update({ format: f })} />
            {f === 'cuenta' ? 'Cuenta' : 'Reporte'}
          </label>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={opts.stamp} onChange={(e) => update({ stamp: e.target.checked })} />
          Imprimir hora y fecha
        </label>
      </div>
      <SignaturesEditor />
    </div>
  )
}

function SignaturesEditor() {
  const { can } = usePermissions()
  const { empresa } = useEmpresa()
  const qc = useQueryClient()
  const saved = useSignatures()
  const [draft, setDraft] = useState<BalanceSignature[] | null>(null)
  const list = draft ?? saved.data ?? EMPTY_SIGNATURES
  const editable = can('core.settings.manage')
  const save = useMutation({
    mutationFn: (value: BalanceSignature[]) =>
      apiFetch('/api/empresa-settings', {
        method: 'PUT',
        json: { namespace: 'gl', key: 'balanceSignatures', value: value.filter((s) => s.name.trim() || s.title.trim()) },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [...SIGNATURES_KEY, empresa.id] })
      setDraft(null)
    },
  })
  const set = (i: number, field: keyof BalanceSignature, v: string) =>
    setDraft(list.map((s, j) => (j === i ? { ...s, [field]: v.toUpperCase() } : s)))

  return (
    <div className="border-t border-blue-200 pt-2">
      <p className="mb-1 font-semibold text-gray-700">Firmas y cargos al pie del balance</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {list.map((s, i) => (
          <div key={i} className="space-y-1">
            <input
              aria-label={`Nombre ${i + 1}`}
              placeholder="Nombre"
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
              value={s.name}
              maxLength={60}
              disabled={!editable}
              onChange={(e) => set(i, 'name', e.target.value)}
            />
            <input
              aria-label={`Cargo ${i + 1}`}
              placeholder="Cargo"
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
              value={s.title}
              maxLength={60}
              disabled={!editable}
              onChange={(e) => set(i, 'title', e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs">
        {editable ? (
          <Button disabled={!draft || save.isPending} onClick={() => draft && save.mutate(draft)}>
            {save.isPending ? 'Guardando…' : 'Guardar firmas'}
          </Button>
        ) : (
          <span className="text-gray-500">Solo un usuario con permiso de configuración de la empresa puede cambiar las firmas.</span>
        )}
        {save.isError && <span className="text-red-700">{errorMessage(save.error)}</span>}
        {draft && !save.isPending && <span className="text-gray-500">Hay cambios sin guardar.</span>}
      </div>
    </div>
  )
}
