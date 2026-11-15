import { and, asc, eq, isNull } from 'drizzle-orm'
import { RuleError, type ServiceContext } from '@accounting/shared/server'
import {
  isGeneratedSource, isIsoDate, type EntryRef, type EntryType, type PostEntryRequest, type SourceRefKey,
} from '@accounting/shared'
import { glJournalEntries as e, glJournalLines as l } from '../schema.js'
import { totalsOf } from '../lib/cents.js'
import type { Ctx } from '../lib/context.js'
import { validateLines, type NormalizedLine } from './entry-lines.js'
import { activeEntryType, unbalancedError } from './entry-rules.js'
import { assertPeriodOpen } from './periods.js'

export type EntryRow = typeof e.$inferSelect

// The provider works with the consumer's context (already on its transaction).
export function ctxFrom(s: ServiceContext): Ctx {
  if (!s.services) throw new Error('ledger: the service context has no registry')
  return { db: s.db, empresaId: s.empresaId, userId: s.userId, role: s.role, audit: s.audit, services: s.services }
}

export function contractError(message: string, status: 400 | 404 | 409, code: string): RuleError {
  return new RuleError(message, status, code)
}

export function assertKey(ref: SourceRefKey): void {
  if (!isGeneratedSource(ref.source)) throw contractError(`Origen no válido: ${ref.source}.`, 400, 'invalid_source')
  if (!ref.sourceRef?.trim()) throw contractError('Falta la referencia del documento de origen.', 400, 'source_ref_required')
}

export type Prepared = { period: string; type: EntryType; lines: NormalizedLine[]; totals: ReturnType<typeof totalsOf> }

// Same validations as manual capture, in one place (contratos.md §1.2).
export function prepare(ctx: Ctx, req: PostEntryRequest): Prepared {
  assertKey(req)
  if (!isIsoDate(req.date)) throw contractError('Fecha inválida (AAAA-MM-DD).', 400, 'invalid_date')
  if (req.lines.length < 2) throw contractError('La partida debe tener al menos dos líneas.', 400, 'too_few_lines')
  const period = req.date.slice(0, 7)
  assertPeriodOpen(ctx, period)
  const type = activeEntryType(ctx, req.entryTypeId)
  const lines = validateLines(
    ctx,
    req.lines.map((x) => ({
      accountId: x.accountId, costCenterId: x.costCenterId ?? null, detail: x.detail ?? '',
      debit: x.debit, credit: x.credit, collectDate: null,
    })),
    req.concept,
    false,
  )
  const totals = totalsOf(lines)
  if (!totals.balanced) throw unbalancedError(totals)
  return { period, type, lines, totals }
}

// The live entry of a document: active, of that origin, not a reversal.
export function findLive(ctx: Ctx, ref: SourceRefKey): EntryRow | undefined {
  return ctx.db.select().from(e).where(and(
    eq(e.empresaId, ctx.empresaId), eq(e.source, ref.source), eq(e.sourceRef, ref.sourceRef),
    eq(e.isActive, true), isNull(e.reversesEntryId),
  )).get()
}

export function reversalOf(ctx: Ctx, entryId: string): EntryRow | undefined {
  return ctx.db.select().from(e)
    .where(and(eq(e.empresaId, ctx.empresaId), eq(e.reversesEntryId, entryId), eq(e.isActive, true))).get()
}

export function refOf(ctx: Ctx, row: EntryRow): EntryRef {
  return {
    entryId: row.id, entryTypeId: row.entryTypeId, period: row.period, number: row.number, date: row.date,
    isActive: row.isActive, source: row.source, sourceRef: row.sourceRef ?? '',
    reversedBy: reversalOf(ctx, row.id)?.id ?? null,
  }
}

const lineKey = (x: Pick<NormalizedLine, 'accountId' | 'costCenterId' | 'detail' | 'debit' | 'credit'>) =>
  [x.accountId, x.costCenterId ?? '', x.detail, x.debit, x.credit].join('|')

// Whether an existing entry already holds exactly this content.
export function sameContent(ctx: Ctx, row: EntryRow, req: PostEntryRequest, p: Prepared): boolean {
  if (row.entryTypeId !== p.type.id || row.date !== req.date || row.concept !== req.concept) return false
  const lines = ctx.db.select().from(l).where(eq(l.entryId, row.id)).orderBy(asc(l.lineNo)).all()
  return lines.length === p.lines.length && lines.every((x, i) => lineKey(x) === lineKey(p.lines[i]!))
}
