'use client'

import { useEffect, useState } from 'react'
import type { Entry, EntryLine } from '@accounting/shared'
import { formatDate, formatMoney } from '@/lib/format'
import { useAccounts } from '../coa/use-coa'
import { buildEntryTree, type TreeNode } from './entry-print-tree'

// Print-only layout of one entry. The formats follow the legacy "Impresión de
// Partidas" options: Legal (formal, with signatures), Preliminar (plain draft)
// and Media carta (compact, half-letter sheet). "Incluir concepto" is the legacy
// option of the same name: it prints each line's detail; the entry's general
// concept is always printed.
type Format = 'legal' | 'preliminar' | 'media'
type Options = { format: Format; concept: boolean }

const FORMATS: { value: Format; label: string; page: string; height: string }[] = [
  { value: 'legal', label: 'Legal', page: '8.5in 14in', height: '14in' },
  { value: 'preliminar', label: 'Preliminar', page: 'letter', height: '11in' },
  { value: 'media', label: '½ carta', page: '8.5in 5.5in', height: '5.5in' },
]
const STORE = 'entry-print-options'
const DEFAULTS: Options = { format: 'legal', concept: true }

function loadOptions(): Options {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<Options> | null
    if (saved && FORMATS.some((f) => f.value === saved.format)) return { ...DEFAULTS, ...saved }
  } catch {
    // Storage unavailable: use the defaults.
  }
  return DEFAULTS
}

export function EntryPrint({ entry, empresa }: { entry: Entry; empresa: string }) {
  const [opts, setOpts] = useState<Options>(DEFAULTS)
  useEffect(() => setOpts(loadOptions()), [])
  const update = (next: Partial<Options>) => {
    const merged = { ...opts, ...next }
    setOpts(merged)
    try {
      localStorage.setItem(STORE, JSON.stringify(merged))
    } catch {
      // Not remembered; still applies to this print.
    }
  }

  const format = FORMATS.find((f) => f.value === opts.format)!
  // Paper size for the printer and for the on-screen sheet.
  useEffect(() => {
    document.documentElement.style.setProperty('--sheet-height', format.height)
    return () => {
      document.documentElement.style.removeProperty('--sheet-height')
    }
  }, [format.height])

  const status = !entry.isActive ? 'ANULADA' : entry.status === 'borrador' ? 'BORRADOR' : ''
  const props = { entry, empresa, status, concept: opts.concept }
  return (
    <div className="hidden text-black print:block">
      <style>{`@page { size: ${format.page}; margin: 0.5in; }`}</style>
      <OptionsPanel opts={opts} update={update} />
      {opts.format === 'legal' && <LegalFormat {...props} />}
      {opts.format === 'preliminar' && <DraftFormat {...props} />}
      {opts.format === 'media' && <HalfLetterFormat {...props} />}
    </div>
  )
}

function OptionsPanel({ opts, update }: { opts: Options; update: (o: Partial<Options>) => void }) {
  return (
    <div className="preview-only mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="font-semibold text-gray-700">Formato:</span>
        {FORMATS.map((f) => (
          <label key={f.value} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name="entry-print-format"
              checked={opts.format === f.value}
              onChange={() => update({ format: f.value })}
            />
            {f.label}
          </label>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={opts.concept} onChange={(e) => update({ concept: e.target.checked })} />
          Incluir concepto
        </label>
      </div>
    </div>
  )
}

type FormatProps = { entry: Entry; empresa: string; status: string; concept: boolean }

const money = (v: string) => (Number(v) === 0 ? '' : formatMoney(v))

function Signatures({ labels, className = 'mt-16' }: { labels: string[]; className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-10 text-center text-xs ${className}`}>
      {labels.map((label) => (
        <div key={label} className="border-t border-black pt-1">{label}</div>
      ))}
    </div>
  )
}

// Legal: the catalog structure as the legacy report (see entry-print-tree.ts):
// cuenta de mayor with the total in Cargo/Abono, the accounts below it with
// their parciales, and each line's detail with its amount.
function LegalFormat({ entry, empresa, status, concept }: FormatProps) {
  const { byId } = useAccounts()
  const tree = buildEntryTree(entry.lines, byId)
  const cell = 'border-r border-black px-2 py-0.5'
  return (
    <div className="text-sm">
      <div className="mb-3 text-center">
        <p className="text-base font-bold">{empresa}</p>
        <p className="font-semibold">{entry.entryTypeName.toUpperCase()} No. {entry.number}</p>
        <p className="text-xs">EXPRESADO EN DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA</p>
      </div>
      <div className="mb-2 grid grid-cols-[auto_1fr] gap-x-6 text-xs">
        <span className="font-semibold">FECHA</span>
        <span>{formatDate(entry.date)}</span>
        <span className="font-semibold">CONCEPTO GENERAL</span>
        <span>{entry.concept}</span>
      </div>
      {status && <p className="mb-2 font-bold">{status}</p>}
      <table className="w-full border-collapse border border-black text-xs">
        <thead>
          <tr className="border-b border-black">
            <th className={`w-20 text-left ${cell} py-1`}>CUENTA</th>
            <th className={`text-left ${cell} py-1`}>DESCRIPCIÓN</th>
            <th colSpan={2} className={`w-40 text-center tracking-[0.3em] ${cell} py-1`}>PARCIALES</th>
            <th className={`w-20 text-right ${cell} py-1`}>CARGO</th>
            <th className="w-20 px-2 py-1 text-right">ABONO</th>
          </tr>
        </thead>
        {tree.flatMap(({ side, nodes }) =>
          nodes.map((mayor) => (
            <tbody key={`${side}-${mayor.code}`} className="break-inside-avoid border-b border-black align-top">
              {legalRows(mayor, 0, concept).map((r) => (
                <tr key={r.key}>
                  <td className={`${cell} font-mono ${r.depth === 0 ? 'font-semibold' : ''}`}>{r.code}</td>
                  <td className={cell} style={{ paddingLeft: `${8 + r.depth * 12}px` }}>
                    <span className={r.depth === 0 ? 'font-semibold' : r.detail ? 'italic' : ''}>{r.text}</span>
                  </td>
                  <td className={`w-20 text-right tabular-nums ${cell}`}>{r.inner ? formatMoney(r.inner) : ''}</td>
                  <td className={`w-20 text-right tabular-nums ${cell}`}>{r.outer ? formatMoney(r.outer) : ''}</td>
                  <td className={`text-right tabular-nums ${cell}`}>{r.depth === 0 && side === 'cargo' ? formatMoney(mayor.amount) : ''}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums">{r.depth === 0 && side === 'abono' ? formatMoney(mayor.amount) : ''}</td>
                </tr>
              ))}
            </tbody>
          )),
        )}
        <tfoot>
          <tr className="border-t border-black font-semibold">
            <td colSpan={4} className={`${cell} py-1 text-right`}>TOTALES</td>
            <td className={`${cell} py-1 text-right tabular-nums`}>{formatMoney(entry.totals.debit)}</td>
            <td className="px-2 py-1 text-right tabular-nums">{formatMoney(entry.totals.credit)}</td>
          </tr>
        </tfoot>
      </table>
      <Signatures labels={['HECHO POR', 'REVISADO POR', 'AUTORIZADO POR']} />
    </div>
  )
}

type LegalRow = { key: string; code: string; text: string; depth: number; inner?: string; outer?: string; detail?: boolean }

// Rows of one mayor: accounts with children show their subtotal in the outer
// parcial; a line's account shows its amount in the inner one only when the
// details are left out, otherwise each detail carries it.
function legalRows(node: TreeNode, depth: number, details: boolean): LegalRow[] {
  const isParent = node.children.length > 0
  const rows: LegalRow[] = [{
    key: `n-${node.code}`, code: node.code, text: depth === 0 ? node.name.toUpperCase() : node.name, depth,
    ...(depth > 0 && isParent ? { outer: node.amount } : {}),
    ...(depth > 0 && !isParent && !details ? { inner: node.amount } : {}),
  }]
  if (details) {
    for (const d of node.details) {
      rows.push({ key: `d-${d.id}`, code: '', text: d.text, depth: depth + 1, inner: d.amount, detail: true })
    }
  }
  for (const c of node.children) rows.push(...legalRows(c, depth + 1, details))
  return rows
}

// Preliminar: plain listing for review, printed date, no borders or signatures.
function DraftFormat({ entry, empresa, status, concept }: FormatProps) {
  return (
    <div className="text-xs">
      <div className="mb-1 flex justify-between">
        <span>{new Date().toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
        <span className="font-semibold">PRELIMINAR</span>
      </div>
      <div className="mb-3 text-center">
        <p className="text-base font-bold">{empresa}</p>
        <p>(VALORES EN DÓLARES)</p>
      </div>
      <div className="mb-3 grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-0.5">
        <span className="text-right font-semibold">TIPO</span>
        <span>{entry.entryTypeName}</span>
        <span className="font-semibold">CONCEPTO GENERAL</span>
        <span />
        <span className="text-right font-semibold">NÚMERO</span>
        <span>{entry.number}</span>
        <span className="col-span-2 row-span-2">{entry.concept}</span>
        <span className="text-right font-semibold">FECHA</span>
        <span>{formatDate(entry.date)}</span>
      </div>
      {status && <p className="mb-2 font-bold">{status}</p>}
      <LinesTable lines={entry.lines} totals={entry.totals} headers={['DEBE', 'HABER']} details={concept} />
    </div>
  )
}

// ½ carta: compact header and table on a half-letter sheet.
function HalfLetterFormat({ entry, empresa, status, concept }: FormatProps) {
  return (
    <div className="text-[11px] leading-tight">
      <div className="mb-1 flex items-baseline justify-between border-b border-black pb-1">
        <span className="font-bold">{empresa}</span>
        <span>{entry.entryTypeName} No. {entry.number} · {formatDate(entry.date)}</span>
      </div>
      <p className="mb-1"><span className="font-semibold">Concepto:</span> {entry.concept}</p>
      {status && <p className="mb-1 font-bold">{status}</p>}
      <LinesTable lines={entry.lines} totals={entry.totals} headers={['CARGO', 'ABONO']} details={concept} />
      <Signatures labels={['Elaborado', 'Revisado', 'Autorizado']} className="mt-8" />
    </div>
  )
}

function LinesTable({ lines, totals, headers, details }: { lines: EntryLine[]; totals: Entry['totals']; headers: [string, string]; details: boolean }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-y border-black">
          <th className="w-24 py-0.5 text-left">CUENTA</th>
          <th className="py-0.5 text-left">NOMBRE</th>
          {details && <th className="py-0.5 text-left">DETALLE</th>}
          <th className="w-10 py-0.5 text-left">C.C.</th>
          <th className="w-24 py-0.5 text-right">{headers[0]}</th>
          <th className="w-24 py-0.5 text-right">{headers[1]}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.id} className="break-inside-avoid align-top">
            <td className="py-0.5 pr-2 font-mono">{l.accountCode}</td>
            <td className="py-0.5 pr-2">{l.accountName}</td>
            {details && <td className="py-0.5 pr-2">{l.detail}</td>}
            <td className="py-0.5 font-mono">{l.costCenterCode ?? ''}</td>
            <td className="py-0.5 text-right tabular-nums">{money(l.debit)}</td>
            <td className="py-0.5 text-right tabular-nums">{money(l.credit)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="font-semibold">
          <td colSpan={details ? 4 : 3} className="pt-1 text-right">TOTAL</td>
          <td className="border-t border-black pt-1 text-right tabular-nums">{formatMoney(totals.debit)}</td>
          <td className="border-t border-black pt-1 text-right tabular-nums">{formatMoney(totals.credit)}</td>
        </tr>
      </tfoot>
    </table>
  )
}
