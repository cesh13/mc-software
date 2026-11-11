import { newId } from './context.js'
import { int, str, type LegacyTables } from './source.js'
import { bump, warn, type ImportReport, type SqlHandle } from './types.js'

export class ImportRefusedError extends Error {
  readonly code = 'ya_importado'
}

// Legacy EMPRESAS.moneda code → ISO 4217. Only the code seen in real data (2) is mapped;
// its meaning could not be confirmed in the FoxPro sources, so it is always reported.
const MONEDAS: Record<number, string> = { 2: 'USD' }

// Tables with an empresa_id that `replace` wipes, children first. gl_journal_lines
// has no empresa_id; it is wiped through its entries.
const WIPE_ORDER = [
  'gl_budgets', 'gl_journal_entries', 'gl_periods', 'gl_fiscal_years',
  'gl_cost_centers', 'gl_entry_types', 'coa_accounts', 'coa_budget_groups',
] as const

export function monedaOf(report: ImportReport, raw: unknown, siglas: string): string {
  const code = int(raw)
  const iso = code !== null ? MONEDAS[code] : undefined
  warn(
    report,
    'moneda',
    iso
      ? `EMPRESAS.moneda=${code} de ${siglas} se interpretó como ${iso} (sin confirmar en el código fuente).`
      : `EMPRESAS.moneda=${String(raw)} de ${siglas} no tiene equivalente conocido; se usó USD.`,
  )
  return iso ?? 'USD'
}

type EmpresaRow = { siglas: string; name: string; moneda: string; grande: number }

function pickTarget(src: LegacyTables, report: ImportReport, wanted?: string): { rows: EmpresaRow[]; target: EmpresaRow } {
  const rows = src['empresas']!
    .map((r) => ({
      siglas: str(r['siglas']),
      name: str(r['empresa']),
      moneda: monedaOf(report, r['moneda'], str(r['siglas'])),
      grande: r['grande'] === true ? 1 : 0,
    }))
    .filter((r) => r.siglas)
  if (rows.length === 0) {
    warn(report, 'empresa_faltante', 'EMPRESAS no tiene registros; se creó una empresa genérica.')
    const generic = { siglas: wanted ?? 'CONTAC', name: '(empresa importada)', moneda: 'USD', grande: 0 }
    return { rows: [generic], target: generic }
  }
  const target = wanted ? rows.find((r) => r.siglas === wanted) : rows[0]
  if (!target) throw new Error(`La empresa ${wanted} no está en EMPRESAS.`)
  if (rows.length > 1 && !wanted) {
    warn(report, 'varias_empresas', `EMPRESAS tiene ${rows.length} empresas; el libro se asignó a ${target.siglas}. Use la opción siglas para elegir otra.`)
  }
  return { rows, target }
}

// Creates (or reuses) the core_empresas rows. Returns the id that owns the ledger.
export function importEmpresas(
  db: SqlHandle, src: LegacyTables, report: ImportReport, now: string, wanted?: string,
): string {
  const { rows, target } = pickTarget(src, report, wanted)
  const find = db.prepare('SELECT id FROM core_empresas WHERE siglas = ?')
  const insert = db.prepare(
    `INSERT INTO core_empresas (id, name, siglas, moneda, gran_contribuyente, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  )
  report.empresas = rows.map((r) => ({ siglas: r.siglas, withData: r === target }))
  let targetId = ''
  for (const r of rows) {
    const existing = find.get(r.siglas) as { id: string } | undefined
    if (existing && r !== target) continue // other empresas are left as they are
    if (existing) {
      db.prepare('UPDATE core_empresas SET name = ?, moneda = ?, gran_contribuyente = ?, updated_at = ? WHERE id = ?')
        .run(r.name, r.moneda, r.grande, now, existing.id)
      targetId = existing.id
      continue
    }
    const id = newId()
    insert.run(id, r.name, r.siglas, r.moneda, r.grande, now, now)
    bump(report, 'core_empresas')
    if (r === target) {
      targetId = id
      report.empresa.created = true
    }
  }
  report.empresa.id = targetId
  report.empresa.siglas = target.siglas
  return targetId
}

// Refuses to touch an empresa that already has ledger data unless `replace` is set.
// This migration tool is the one place a physical DELETE is allowed: it wipes
// the previous *import* of one empresa so the load can be repeated.
export function prepareEmpresa(db: SqlHandle, empresaId: string, siglas: string, replace: boolean, report: ImportReport): void {
  const used = WIPE_ORDER.filter(
    (t) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE empresa_id = ?`).get(empresaId) as { n: number }).n > 0,
  )
  if (used.length === 0) return
  if (!replace) {
    throw new ImportRefusedError(`La empresa ${siglas} ya tiene datos contables (${used.join(', ')}). Use --replace para reemplazar la importación anterior.`)
  }
  const manual = db
    .prepare("SELECT COUNT(*) AS n FROM gl_journal_entries WHERE empresa_id = ? AND source <> 'importado'")
    .get(empresaId) as { n: number }
  if (manual.n > 0) {
    throw new ImportRefusedError(`La empresa ${siglas} tiene ${manual.n} partidas que no vienen del sistema anterior; no se puede reemplazar.`)
  }
  db.prepare('DELETE FROM gl_journal_lines WHERE entry_id IN (SELECT id FROM gl_journal_entries WHERE empresa_id = ?)').run(empresaId)
  db.prepare('UPDATE coa_accounts SET parent_id = NULL WHERE empresa_id = ?').run(empresaId)
  for (const t of WIPE_ORDER) db.prepare(`DELETE FROM ${t} WHERE empresa_id = ?`).run(empresaId)
  report.empresa.replaced = true
}
