import path from 'node:path'
import { newId } from '../contac/context.js'
import type { SqlHandle } from '../contac/types.js'
import { groupParties } from './merge.js'
import { loadParties } from './sources.js'
import { newPartiesReport, type PartiesImportOptions, type PartiesImportReport } from './types.js'
import { loadExisting, refKey, wipeImported, writeGroups } from './write.js'

type EmpresaRow = { id: string; siglas: string }

function resolveEmpresa(db: SqlHandle, o: PartiesImportOptions): EmpresaRow {
  if (o.empresaId || o.siglas) {
    const row = (o.empresaId
      ? db.prepare('SELECT id, siglas FROM core_empresas WHERE id = ?').get(o.empresaId)
      : db.prepare('SELECT id, siglas FROM core_empresas WHERE siglas = ?').get(o.siglas)) as EmpresaRow | undefined
    if (!row) throw new Error(`La empresa ${o.empresaId ?? o.siglas} no existe en la plataforma.`)
    return row
  }
  const rows = db.prepare('SELECT id, siglas FROM core_empresas WHERE is_active = 1').all() as EmpresaRow[]
  if (rows.length !== 1) {
    throw new Error(rows.length === 0
      ? 'No hay empresas en la plataforma; importe primero CONTAC o cree la empresa.'
      : `Hay ${rows.length} empresas; indique cuál con --siglas.`)
  }
  return rows[0]!
}

// Imports customers and suppliers from the legacy masters (CCCLI01, PROVEDOR ×2,
// CONTRIBU ×2, CLIENTES ×2) into pty_parties, in one transaction. Idempotent by
// legacy key: rows already imported are skipped; `replace` wipes the previous
// import of this empresa first. SQL is written directly (run with the API stopped).
export function importParties(db: SqlHandle, options: PartiesImportOptions): PartiesImportReport {
  const report = newPartiesReport()
  const rows = loadParties(path.resolve(options.sourceRoot), report)
  const now = options.now ?? new Date().toISOString()
  const userId = options.userId ?? 'importador'

  db.transaction(() => {
    const empresa = resolveEmpresa(db, options)
    report.empresa = { id: empresa.id, siglas: empresa.siglas }
    if (options.replace) report.replaced = wipeImported(db, empresa.id, now)
    const existing = loadExisting(db, empresa.id)
    const fresh = rows.filter((r) => !existing.refs.has(refKey(r.ref)))
    report.rowsAlreadyImported = rows.length - fresh.length
    const groups = groupParties(fresh, report)
    writeGroups({ db, empresaId: empresa.id, now, existing, report }, groups)
    db.prepare(
      `INSERT INTO core_audit_log (id, empresa_id, user_id, at, module, action, entity, entity_id, detail)
       VALUES (?, ?, ?, ?, 'legacy-import', 'importar', 'parties', ?, ?)`,
    ).run(newId(), empresa.id, userId, now, empresa.id, JSON.stringify({
      counts: report.counts, merges: report.mergesSummary, conflicts: report.conflictsSummary, replaced: report.replaced,
    }))
  })()
  return report
}
