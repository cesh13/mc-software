import { newId } from '../contac/context.js'
import type { SqlHandle } from '../contac/types.js'
import { mergeGroup, type Group, type MergedParty } from './merge.js'
import type { LegacyRef, PartiesImportReport } from './types.js'

type ExistingRow = {
  id: string
  code: string
  nrc: string | null
  nit: string | null
  legacy_refs: string | null
  is_customer: number
  is_supplier: number
}

export type Existing = {
  byNrc: Map<string, ExistingRow>
  byNit: Map<string, ExistingRow>
  codes: Set<string>
  // 'TABLE|key' of every legacy row already imported into this empresa.
  refs: Set<string>
}

export const refKey = (r: LegacyRef): string => `${r.table}|${r.key}`

const parseRefs = (raw: string | null): LegacyRef[] => (raw ? (JSON.parse(raw) as LegacyRef[]) : [])

// The one place parties are physically deleted: wiping a previous *import* so
// it can be repeated. Parties captured in the platform (they have a 'crear'
// audit row) stay; if the import had joined legacy rows to them, those refs go.
export function wipeImported(db: SqlHandle, empresaId: string, now: string): { deleted: number; detached: number } {
  const detached = db
    .prepare(
      `UPDATE pty_parties SET legacy_refs = NULL, updated_at = ?
       WHERE empresa_id = ? AND legacy_refs IS NOT NULL AND id IN (
         SELECT entity_id FROM core_audit_log WHERE module = 'parties' AND action = 'crear' AND entity = 'tercero')`,
    )
    .run(now, empresaId) as { changes: number }
  const deleted = db.prepare('DELETE FROM pty_parties WHERE empresa_id = ? AND legacy_refs IS NOT NULL').run(empresaId) as { changes: number }
  return { deleted: deleted.changes, detached: detached.changes }
}

export function loadExisting(db: SqlHandle, empresaId: string): Existing {
  const rows = db
    .prepare('SELECT id, code, nrc, nit, legacy_refs, is_customer, is_supplier FROM pty_parties WHERE empresa_id = ? ORDER BY is_active DESC, code')
    .all(empresaId) as ExistingRow[]
  const out: Existing = { byNrc: new Map(), byNit: new Map(), codes: new Set(), refs: new Set() }
  for (const r of rows) {
    out.codes.add(r.code)
    if (r.nrc && !out.byNrc.has(r.nrc)) out.byNrc.set(r.nrc, r)
    if (r.nit && !out.byNit.has(r.nit)) out.byNit.set(r.nit, r)
    for (const ref of parseRefs(r.legacy_refs)) out.refs.add(refKey(ref))
  }
  return out
}

// Legacy code if free, else a generated 'T00001'-style code.
function pickCode(p: MergedParty, codes: Set<string>, report: PartiesImportReport): string {
  const free = p.codes.find((c) => !codes.has(c))
  if (free) return free
  let n = codes.size + 1
  while (codes.has(`T${String(n).padStart(5, '0')}`)) n++
  if (p.codes.length) report.counts.codesGeneratedCodeTaken++
  else report.counts.codesGeneratedNoLegacyCode++
  return `T${String(n).padStart(5, '0')}`
}

function tally(report: PartiesImportReport, p: MergedParty, kind: string): void {
  const c = report.counts
  if (p.isCustomer) c.customers++
  if (p.isSupplier) c.suppliers++
  if (p.isCustomer && p.isSupplier) c.bothRoles++
  if (kind === 'person') c.persons++
  else c.companies++
  if (!p.isActive) c.inactive++
  if (!p.nrc && !p.nit && !p.dui) c.withoutTaxId++
}

type WriteCtx = { db: SqlHandle; empresaId: string; now: string; existing: Existing; report: PartiesImportReport }

function joinExisting(ctx: WriteCtx, row: ExistingRow, p: MergedParty, g: Group): void {
  const refs = [...parseRefs(row.legacy_refs), ...p.refs]
  ctx.db
    .prepare('UPDATE pty_parties SET is_customer = ?, is_supplier = ?, legacy_refs = ?, updated_at = ? WHERE id = ?')
    .run(row.is_customer || p.isCustomer ? 1 : 0, row.is_supplier || p.isSupplier ? 1 : 0, JSON.stringify(refs), ctx.now, row.id)
  row.legacy_refs = JSON.stringify(refs)
  ctx.report.counts.partiesUpdated++
  ctx.report.merges.push({ key: g.key, refs: p.refs, existingPartyCode: row.code })
  ctx.report.mergesSummary.intoExisting++
}

function insert(ctx: WriteCtx, p: MergedParty): void {
  const code = pickCode(p, ctx.existing.codes, ctx.report)
  ctx.existing.codes.add(code)
  const kind = p.dui ? 'person' : 'company'
  ctx.db
    .prepare(
      `INSERT INTO pty_parties (id, empresa_id, code, name, trade_name, kind, is_customer, is_supplier, nit, nrc, dui,
        passport, foreign_id, is_foreign, economic_activity_code, email, phone, address, department_code,
        municipality_code, is_active, legacy_refs, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId(), ctx.empresaId, code, p.name, p.tradeName, kind, p.isCustomer ? 1 : 0, p.isSupplier ? 1 : 0,
      p.nit, p.nrc, p.dui, p.passport, p.foreignId, p.isForeign ? 1 : 0, p.economicActivityCode, p.email,
      p.phone, p.address, p.departmentCode, p.municipalityCode, p.isActive ? 1 : 0, JSON.stringify(p.refs),
      ctx.now, ctx.now,
    )
  ctx.report.counts.partiesCreated++
  tally(ctx.report, p, kind)
}

export function writeGroups(ctx: WriteCtx, groups: Group[]): void {
  const s = ctx.report.mergesSummary
  for (const g of groups) {
    const p = mergeGroup(g)
    const match =
      g.via === 'nrc' ? ctx.existing.byNrc.get(p.nrc!) : g.via === 'nit' ? ctx.existing.byNit.get(p.nit!) : undefined
    if (match) {
      joinExisting(ctx, match, p, g)
      continue
    }
    if (g.members.length > 1) {
      s.total++
      if (p.isCustomer && p.isSupplier) s.bothRoles++
      if (new Set(p.refs.map((r) => r.table)).size < p.refs.length) s.repeatedInSource++
      if (g.via === 'nit' || g.members.some((m) => !m.nrc)) s.byNit++
      ctx.report.merges.push({ key: g.key, refs: p.refs })
    }
    insert(ctx, p)
  }
}
