import { eq } from 'drizzle-orm'
import { newId, nowIso, type LedgerPosting, type ServiceContext } from '@accounting/shared/server'
import { periodLabel, type EntryRef, type PostEntryRequest } from '@accounting/shared'
import { glJournalEntries as e, glJournalLines as l } from '../schema.js'
import { auditIn, type Ctx } from '../lib/context.js'
import { insertLines, snapshot } from './entries-write.js'
import { assignNumber, nextNumber } from './numbering.js'
import { isPeriodClosed } from './periods.js'
import {
  contractError, ctxFrom, findLive, prepare, refOf, sameContent, type EntryRow, type Prepared,
} from './ledger-common.js'
import { voidGenerated } from './ledger-void.js'

// Inserts a generated entry, always 'aplicada', numbered by the GL (contratos.md §1.3).
export function insertGenerated(
  ctx: Ctx, req: PostEntryRequest, p: Prepared, extra: { reversesEntryId?: string; sourceRef?: string } = {},
): EntryRow {
  const { number } = assignNumber(ctx, p.period, p.type)
  const id = newId()
  const now = nowIso()
  ctx.db.insert(e).values({
    id, empresaId: ctx.empresaId, period: p.period, entryTypeId: p.type.id, number, date: req.date,
    concept: req.concept, status: 'aplicada', source: req.source, sourceRef: extra.sourceRef ?? req.sourceRef,
    reversesEntryId: extra.reversesEntryId ?? null, createdBy: ctx.userId, createdAt: now, updatedAt: now,
  }).run()
  insertLines(ctx, id, p.lines)
  auditIn(ctx, extra.reversesEntryId ? 'reversar' : 'contabilizar', 'journal_entry', id, {
    via: req.source, sourceRef: extra.sourceRef ?? req.sourceRef, period: p.period, number, totals: p.totals,
  })
  return ctx.db.select().from(e).where(eq(e.id, id)).get()!
}

function post(ctx: Ctx, req: PostEntryRequest): EntryRef {
  const p = prepare(ctx, req)
  const existing = findLive(ctx, req)
  if (existing) {
    if (sameContent(ctx, existing, req, p)) return refOf(ctx, existing)
    throw contractError(
      `El documento ${req.sourceRef} ya tiene partida (${existing.number}); para cambiarla use reemplazar.`,
      409, 'already_posted',
    )
  }
  return refOf(ctx, insertGenerated(ctx, req, p))
}

function replace(ctx: Ctx, req: PostEntryRequest): EntryRef {
  const old = findLive(ctx, req)
  if (!old) throw contractError(`El documento ${req.sourceRef} no tiene partida.`, 404, 'entry_not_found')
  if (isPeriodClosed(ctx, old.period)) {
    throw contractError(
      `La partida del documento está en ${periodLabel(old.period)}, que está cerrado: anule el documento y emita otro.`,
      409, 'period_closed',
    )
  }
  const p = prepare(ctx, req)
  if (sameContent(ctx, old, req, p)) return refOf(ctx, old)
  if (old.period === p.period && old.entryTypeId === p.type.id) {
    const before = snapshot(ctx, old)
    ctx.db.update(e).set({ date: req.date, concept: req.concept, updatedAt: nowIso() }).where(eq(e.id, old.id)).run()
    ctx.db.delete(l).where(eq(l.entryId, old.id)).run()
    insertLines(ctx, old.id, p.lines)
    auditIn(ctx, 'reemplazar', 'journal_entry', old.id, { via: req.source, before, totals: p.totals })
    return refOf(ctx, ctx.db.select().from(e).where(eq(e.id, old.id)).get()!)
  }
  ctx.db.update(e).set({ isActive: false, updatedAt: nowIso() }).where(eq(e.id, old.id)).run()
  auditIn(ctx, 'anular', 'journal_entry', old.id, { via: req.source, reason: 'reemplazada' })
  return refOf(ctx, insertGenerated(ctx, req, p))
}

// Implementation of the `ledger` contract. Never opens a transaction: the
// consumer's context is already on its own (contratos.md §0.2).
export function ledgerProvider(s: ServiceContext): LedgerPosting {
  const ctx = ctxFrom(s)
  return {
    post: (req) => post(ctx, req),
    replace: (req) => replace(ctx, req),
    void: (ref, opts) => voidGenerated(ctx, ref, opts),
    find: (ref) => {
      const row = findLive(ctx, ref)
      return row ? refOf(ctx, row) : null
    },
    preview: (req) => {
      const p = prepare(ctx, req)
      return { period: p.period, nextNumber: nextNumber(ctx, p.period, p.type), totals: { debit: p.totals.debit, credit: p.totals.credit } }
    },
  }
}
