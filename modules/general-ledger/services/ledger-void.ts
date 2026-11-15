import { asc, eq } from 'drizzle-orm'
import { nowIso } from '@accounting/shared/server'
import type { GlGeneratedSource, SourceRefKey, VoidResult } from '@accounting/shared'
import { glJournalEntries as e, glJournalLines as l } from '../schema.js'
import { auditIn, type Ctx } from '../lib/context.js'
import { isPeriodClosed } from './periods.js'
import { assertKey, contractError, findLive, prepare, refOf } from './ledger-common.js'
import { insertGenerated } from './ledger-provider.js'

// Void the entry of a document (contratos.md §1.4). Open month: anulada, keeps
// its number. Closed month: the original stays and a reversal entry is created
// on `opts.date`, which must fall in an open month.
export function voidGenerated(ctx: Ctx, ref: SourceRefKey, opts: { date: string; reason: string }): VoidResult {
  assertKey(ref)
  if (!opts.reason?.trim()) throw contractError('Indique el motivo de la anulación.', 400, 'void_reason_required')
  const row = findLive(ctx, ref)
  if (!row) throw contractError(`El documento ${ref.sourceRef} no tiene partida.`, 404, 'entry_not_found')
  const original = refOf(ctx, row)
  if (original.reversedBy) throw contractError('La partida del documento ya fue reversada.', 409, 'entry_voided')

  if (!isPeriodClosed(ctx, row.period)) {
    ctx.db.update(e).set({ isActive: false, updatedAt: nowIso() }).where(eq(e.id, row.id)).run()
    auditIn(ctx, 'anular', 'journal_entry', row.id, { via: ref.source, reason: opts.reason })
    return { kind: 'anulada', entry: refOf(ctx, { ...row, isActive: false }) }
  }

  const lines = ctx.db.select().from(l).where(eq(l.entryId, row.id)).orderBy(asc(l.lineNo)).all()
  const req = {
    source: ref.source as GlGeneratedSource,
    sourceRef: ref.sourceRef,
    entryTypeId: row.entryTypeId,
    date: opts.date,
    concept: `Reverso de ${row.number}: ${opts.reason}`.slice(0, 120),
    lines: lines.map((x) => ({
      accountId: x.accountId, costCenterId: x.costCenterId, detail: x.detail, debit: x.credit, credit: x.debit,
    })),
  }
  const reversal = insertGenerated(ctx, req, prepare(ctx, req), {
    reversesEntryId: row.id, sourceRef: `${ref.sourceRef}:reverso`,
  })
  return { kind: 'reversada', original: refOf(ctx, row), reversal: refOf(ctx, reversal) }
}
