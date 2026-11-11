import { Decimal } from 'decimal.js'
import { lastDayOfPeriod, periodFromSalfec } from '@accounting/shared'
import { ensureAccount, ensureCostCenter, ensureEntryType, newId, type Ctx } from './context.js'
import { money, str, type LegacyTables, type Row } from './source.js'
import { bump, warn } from './types.js'

export const ORPHAN_CONCEPT = '(sin encabezado en el sistema anterior)'

const keyOf = (r: Row) => `${str(r['salfec'])}|${str(r['tipopar'])}|${str(r['numero'])}`

// Digits actually used per entry type (headers and lines); types never used keep the default.
export function numberWidths(src: LegacyTables): Map<string, number> {
  const widths = new Map<string, number>()
  for (const r of [...src['partidas']!, ...src['detapart']!]) {
    const n = str(r['numero'])
    const t = str(r['tipopar'])
    if (n) widths.set(t, Math.max(widths.get(t) ?? 0, n.length))
  }
  return widths
}

type Pending = { key: string; header: Row | null; lines: Row[] }

// Live headers first (file order), then line groups that have no live header.
function collect(ctx: Ctx): Pending[] {
  const byKey = new Map<string, Pending>()
  const out: Pending[] = []
  for (const h of ctx.src['partidas']!) {
    const key = keyOf(h)
    if (byKey.has(key)) {
      warn(ctx.report, 'encabezado_duplicado', `Encabezado repetido ${key}; se conserva el primero.`)
      continue
    }
    const p: Pending = { key, header: h, lines: [] }
    byKey.set(key, p)
    out.push(p)
  }
  for (const l of ctx.src['detapart']!) {
    const key = keyOf(l)
    let p = byKey.get(key)
    if (!p) {
      p = { key, header: null, lines: [] }
      byKey.set(key, p)
      out.push(p)
    }
    p.lines.push(l)
  }
  return out
}

function periodOf(p: Pending): string | null {
  const salfec = str(p.header?.['salfec'] ?? p.lines[0]?.['salfec'])
  if (/^\d{6}$/.test(salfec) && Number(salfec.slice(4)) >= 1 && Number(salfec.slice(4)) <= 12) return periodFromSalfec(salfec)
  const date = p.header?.['fecha']
  return typeof date === 'string' ? date.slice(0, 7) : null
}

// PARTIDAS + DETAPART → gl_journal_entries + gl_journal_lines.
// Returns per-month totals and the set of months with entries.
export function importEntries(ctx: Ctx): Map<string, { total: number; closed: number }> {
  const { report } = ctx
  const stats = new Map<string, { total: number; closed: number }>()
  const insertEntry = ctx.db.prepare(
    `INSERT INTO gl_journal_entries (id, empresa_id, period, entry_type_id, number, date, concept, status,
       imported_unbalanced, source, source_ref, is_active, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'aplicada', ?, 'importado', ?, 1, ?, ?, ?)`,
  )
  const insertLine = ctx.db.prepare(
    `INSERT INTO gl_journal_lines (id, entry_id, line_no, account_id, cost_center_id, detail, debit, credit, collect_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  for (const p of collect(ctx)) {
    const period = periodOf(p)
    if (!period) {
      warn(report, 'partida_sin_periodo', `La partida ${p.key} no tiene mes ni fecha válidos; no se importó.`)
      continue
    }
    const header = p.header
    const dateRaw = header?.['fecha']
    let date: string
    if (header && typeof dateRaw === 'string') {
      date = dateRaw
      if (date.slice(0, 7) !== period) warn(report, 'fecha_fuera_de_mes', `La partida ${p.key} tiene fecha fuera de su mes.`)
    } else {
      const dates = p.lines.map((l) => l['fecha']).filter((d): d is string => typeof d === 'string' && d.slice(0, 7) === period)
      date = dates.length ? dates.sort().at(-1)! : lastDayOfPeriod(period)
      if (header) warn(report, 'partida_sin_fecha', `La partida ${p.key} no tiene fecha; se usó otra del mes.`)
    }
    if (!header) report.orphanHeaders.push({ key: p.key, lines: p.lines.length })

    let debit = new Decimal(0)
    let credit = new Decimal(0)
    const entryId = newId()
    const typeCode = str(p.header?.['tipopar'] ?? p.lines[0]?.['tipopar'])
    const typeId = ctx.entryTypes.get(typeCode) ?? ensureEntryType(ctx, typeCode, numberWidths(ctx.src).get(typeCode) ?? 6)
    const number = str(p.header?.['numero'] ?? p.lines[0]?.['numero'])
    if (!number) warn(report, 'numero_vacio', `La partida ${p.key} no tiene número en el sistema anterior.`)
    const lineRows: unknown[][] = []
    p.lines.forEach((l, i) => {
      const dr = money(report, l['cargo'], `línea de ${p.key}`)
      const cr = money(report, l['abono'], `línea de ${p.key}`)
      debit = debit.plus(dr)
      credit = credit.plus(cr)
      if (new Decimal(dr).isNeg() || new Decimal(cr).isNeg()) warn(report, 'monto_negativo', `Línea con monto negativo en ${p.key}.`)
      if (!new Decimal(dr).isZero() && !new Decimal(cr).isZero()) warn(report, 'cargo_y_abono', `Línea con cargo y abono a la vez en ${p.key}.`)
      const code = str(l['cuenta'])
      if (!ctx.accounts.has(code)) warn(report, 'cuenta_no_encontrada', `La cuenta ${code || '(vacía)'} no está en el catálogo (partida ${p.key}).`)
      const cc = str(l['ccosto'])
      lineRows.push([
        newId(), entryId, i + 1, ensureAccount(ctx, code), cc ? ensureCostCenter(ctx, cc) : null,
        str(l['detalle']), dr, cr, typeof l['fcobro'] === 'string' ? l['fcobro'] : null,
      ])
    })
    const diff = debit.minus(credit)
    if (!diff.isZero()) report.unbalancedEntries.push({ key: p.key, difference: diff.toFixed(2) })
    insertEntry.run(
      entryId, ctx.empresaId, period, typeId, number, date, header ? str(header['concepto']) : ORPHAN_CONCEPT,
      diff.isZero() ? 0 : 1, p.key, ctx.userId, ctx.now, ctx.now,
    )
    bump(report, 'gl_journal_entries')
    for (const row of lineRows) insertLine.run(...row)
    bump(report, 'gl_journal_lines', lineRows.length)

    const s = stats.get(period) ?? { total: 0, closed: 0 }
    s.total++
    if (header?.['cerrado'] === true) s.closed++
    stats.set(period, s)
  }
  return stats
}
