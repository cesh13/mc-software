import { newId, type Ctx } from './context.js'
import { int, str } from './source.js'
import { bump, warn } from './types.js'

// TIPOPAR → gl_entry_types. `widths` = digits actually used per type code.
export function importEntryTypes(ctx: Ctx, widths: Map<string, number>): void {
  const insert = ctx.db.prepare(
    `INSERT INTO gl_entry_types (id, empresa_id, code, name, is_bank, number_width, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
  for (const r of ctx.src['tipopar']!) {
    const code = str(r['tipopar'])
    if (!code || ctx.entryTypes.has(code)) continue
    const id = newId()
    insert.run(id, ctx.empresaId, code, str(r['nombre']), r['bancos'] === true ? 1 : 0, widths.get(code) ?? 6, ctx.now, ctx.now)
    ctx.entryTypes.set(code, id)
    bump(ctx.report, 'gl_entry_types')
  }
}

// CCOSTO → gl_cost_centers.
export function importCostCenters(ctx: Ctx): void {
  const insert = ctx.db.prepare(
    `INSERT INTO gl_cost_centers (id, empresa_id, code, name, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
  )
  for (const r of ctx.src['ccosto']!) {
    const code = str(r['codigo'])
    if (!code || ctx.costCenters.has(code)) continue
    const id = newId()
    insert.run(id, ctx.empresaId, code, str(r['descrip']), ctx.now, ctx.now)
    ctx.costCenters.set(code, id)
    bump(ctx.report, 'gl_cost_centers')
  }
}

// PERIODO is unreliable (one stale row), so each calendar year that has data gets a
// January–December fiscal year. Returns year → fiscal_year id.
export function importFiscalYears(ctx: Ctx, years: Iterable<string>): Map<string, string> {
  const out = new Map<string, string>()
  const insert = ctx.db.prepare(
    `INSERT INTO gl_fiscal_years (id, empresa_id, name, start_period, end_period, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const y of [...new Set(years)].sort()) {
    const id = newId()
    insert.run(id, ctx.empresaId, y, `${y}-01`, `${y}-12`, ctx.now, ctx.now)
    out.set(y, id)
    bump(ctx.report, 'gl_fiscal_years')
  }
  const rows = ctx.src['periodo']!
  const legacy = rows.map((r) => `${str(r['anio'])}/${str(r['anio2'])} (mes ${int(r['inicio'])}–${int(r['fin'])})`)
  warn(
    ctx.report,
    'periodo_no_confiable',
    `PERIODO tiene ${rows.length} fila(s) [${legacy.join('; ')}] que no coinciden con los datos; ` +
      `se crearon ejercicios enero–diciembre para ${[...out.keys()].join(', ') || 'ningún año'}.`,
  )
  for (const r of rows) {
    if (str(r['cata'])) warn(ctx.report, 'catalogo_alterno', `PERIODO indica un catálogo alterno (${str(r['cata'])}); no se migra.`)
  }
  return out
}

// cerrado → gl_periods. Closed only when every entry of the month is closed.
export function importPeriods(ctx: Ctx, stats: Map<string, { total: number; closed: number }>): void {
  const insert = ctx.db.prepare(
    `INSERT INTO gl_periods (id, empresa_id, period, status, closed_by, closed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const [period, s] of [...stats].sort(([a], [b]) => a.localeCompare(b))) {
    const closed = s.total > 0 && s.closed === s.total
    if (s.closed > 0 && !closed) ctx.report.periods.mixed.push(period)
    insert.run(newId(), ctx.empresaId, period, closed ? 'closed' : 'open', closed ? ctx.userId : null, closed ? ctx.now : null, ctx.now)
    ctx.report.periods[closed ? 'closed' : 'open']++
    bump(ctx.report, 'gl_periods')
  }
  if (ctx.report.periods.mixed.length) {
    warn(ctx.report, 'meses_mixtos', `Meses con partidas cerradas y abiertas (quedan abiertos): ${ctx.report.periods.mixed.join(', ')}.`)
  }
}
