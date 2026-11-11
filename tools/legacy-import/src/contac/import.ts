import { newId, type Ctx } from './context.js'
import { importBudgetGroups, importCatalog } from './catalog.js'
import { budgetRows, importBudgets } from './budgets.js'
import { importEmpresas, prepareEmpresa } from './empresa.js'
import { importEntries, numberWidths } from './entries.js'
import { importCostCenters, importEntryTypes, importFiscalYears, importPeriods } from './setup.js'
import { loadSource } from './source.js'
import { newReport, type ImportOptions, type ImportReport, type SqlHandle } from './types.js'

// Imports one CONTAC folder into the platform tables, all in one transaction.
// Throws (and rolls everything back) if the empresa already has data and
// `replace` is not set.
export function importContac(db: SqlHandle, options: ImportOptions): ImportReport {
  const report = newReport()
  const src = loadSource(options.sourceDir, report)
  const now = options.now ?? new Date().toISOString()
  const userId = options.userId ?? 'importador'

  db.transaction(() => {
    const empresaId = importEmpresas(db, src, report, now, options.siglas)
    prepareEmpresa(db, empresaId, report.empresa.siglas, options.replace === true, report)
    const ctx: Ctx = {
      db, report, src, empresaId, userId, now,
      accounts: new Map(), entryTypes: new Map(), costCenters: new Map(), budgetGroups: new Map(),
    }
    importBudgetGroups(ctx)
    importCatalog(ctx)
    importCostCenters(ctx)
    importEntryTypes(ctx, numberWidths(src))
    const stats = importEntries(ctx)
    const budgets = budgetRows(ctx)
    const years = [...stats.keys(), ...budgets.map((b) => `${b.year}-01`)].map((p) => p.slice(0, 4))
    const fiscalYears = importFiscalYears(ctx, years)
    importPeriods(ctx, stats)
    importBudgets(ctx, budgets, fiscalYears)
    db.prepare(
      `INSERT INTO core_audit_log (id, empresa_id, user_id, at, module, action, entity, entity_id, detail)
       VALUES (?, ?, ?, ?, 'legacy-import', 'importar', 'contac', ?, ?)`,
    ).run(newId(), empresaId, userId, now, empresaId, JSON.stringify({ counts: report.counts, replaced: report.empresa.replaced }))
  })()
  return report
}
