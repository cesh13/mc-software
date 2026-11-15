import { randomUUID } from 'node:crypto'
import type { SqlHandle } from '../contac/types.js'

// Re-attribution of imported journal entries to the module that produced them
// (docs/sistema/contratos.md §1.9). Each module importer (Bancos, CxP, Activo
// fijo…) finds its entries by the legacy key and hands them over here.

export type Reattribution = {
  // Legacy key SALFEC|TIPOPAR|NUMERO, stored in gl_journal_entries.legacy_ref.
  legacyKey: string
  toSource: string
  // Id of the owning document in the new module.
  sourceRef: string
  confidence: 'exacta' | 'inferida'
}

export type ReattributeReport = {
  updated: number
  // Keys with no imported entry, or whose entry is no longer 'importado'.
  notFound: string[]
  // Keys asked twice in the same call (only the first is applied).
  duplicates: string[]
}

const GENERATED = new Set(['bancos', 'cxp', 'cxc', 'ventas', 'inventario', 'produccion', 'activo_fijo', 'nomina', 'iva'])

// Only rows still `source = 'importado'` change, so re-running is harmless.
// Runs in one transaction with one audit row; the API must be stopped.
export function reattributeEntries(
  db: SqlHandle,
  empresaId: string,
  items: Reattribution[],
  opts: { userId?: string; now?: string } = {},
): ReattributeReport {
  for (const it of items) {
    if (!GENERATED.has(it.toSource)) throw new Error(`reattributeEntries: origin not allowed: ${it.toSource}`)
    if (!it.sourceRef) throw new Error(`reattributeEntries: empty sourceRef for ${it.legacyKey}`)
  }
  const report: ReattributeReport = { updated: 0, notFound: [], duplicates: [] }
  const update = db.prepare(
    `UPDATE gl_journal_entries SET source = ?, source_ref = ?, origin_confidence = ?, updated_at = ?
     WHERE empresa_id = ? AND legacy_ref = ? AND source = 'importado'`,
  )
  const now = opts.now ?? new Date().toISOString()
  db.transaction(() => {
    const seen = new Set<string>()
    for (const it of items) {
      if (seen.has(it.legacyKey)) {
        report.duplicates.push(it.legacyKey)
        continue
      }
      seen.add(it.legacyKey)
      const res = update.run(it.toSource, it.sourceRef, it.confidence, now, empresaId, it.legacyKey) as { changes: number }
      if (res.changes > 0) report.updated += res.changes
      else report.notFound.push(it.legacyKey)
    }
    const bySource: Record<string, number> = {}
    for (const it of items) bySource[it.toSource] = (bySource[it.toSource] ?? 0) + 1
    db.prepare(
      `INSERT INTO core_audit_log (id, empresa_id, user_id, at, module, action, entity, entity_id, detail)
       VALUES (?, ?, ?, ?, 'legacy-import', 'reatribuir', 'journal_entry', NULL, ?)`,
    ).run(randomUUID(), empresaId, opts.userId ?? 'importador', now, JSON.stringify({
      requested: items.length, updated: report.updated, notFound: report.notFound.length, bySource,
    }))
  })()
  return report
}
