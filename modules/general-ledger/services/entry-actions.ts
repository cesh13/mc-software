import { asc, eq } from 'drizzle-orm'
import { can } from '@accounting/shared'
import { RuleError, newId, nowIso } from '@accounting/shared/server'
import type { Entry, EntrySaveResult, copyEntryInput } from '@accounting/shared'
import type { z } from 'zod'
import { glJournalEntries as e, glJournalLines as l } from '../schema.js'
import { totalsOf } from '../lib/cents.js'
import { auditIn, inTx, type Ctx } from '../lib/context.js'
import { getEntry, loadEntry } from './entry-detail.js'
import { validateLines } from './entry-lines.js'
import { activeEntryType, assertDateInPeriod, assertEditable, unbalancedError } from './entry-rules.js'
import { insertLines } from './entries-write.js'
import { assertPeriodOpen } from './periods.js'
import { assignNumber } from './numbering.js'

function setStatus(ctx: Ctx, id: string, status: 'borrador' | 'aplicada') {
  ctx.db.update(e)
    .set({ status, importedUnbalanced: false, updatedAt: nowIso() })
    .where(eq(e.id, id))
    .run()
}

// borrador → aplicada. Lines are validated again (accounts may have changed
// since the draft was saved) and the entry must balance.
export function applyEntry(ctx: Ctx, id: string): Entry {
  inTx(ctx, (tx) => {
    const row = loadEntry(tx, id)
    assertEditable(row)
    if (row.status === 'aplicada') {
      throw new RuleError('La partida ya está aplicada.', 409, 'entry_already_applied')
    }
    assertPeriodOpen(tx, row.period)
    const lines = tx.db.select().from(l).where(eq(l.entryId, id)).orderBy(asc(l.lineNo)).all()
    validateLines(tx, lines, row.concept, true)
    const totals = totalsOf(lines)
    if (!totals.balanced) throw unbalancedError(totals)
    setStatus(tx, id, 'aplicada')
    auditIn(tx, 'aplicar', 'journal_entry', id, { totals })
  })
  return getEntry(ctx, id)
}

// aplicada → borrador (supervisors only; checked by the route).
export function unapplyEntry(ctx: Ctx, id: string): Entry {
  inTx(ctx, (tx) => {
    const row = loadEntry(tx, id)
    assertEditable(row)
    if (row.status === 'borrador') {
      throw new RuleError('La partida ya es un borrador.', 409, 'entry_not_applied')
    }
    assertPeriodOpen(tx, row.period)
    setStatus(tx, id, 'borrador')
    auditIn(tx, 'desaplicar', 'journal_entry', id)
  })
  return getEntry(ctx, id)
}

const VOID_BLOCKED: Record<string, string> = {
  bancos: 'Elimine desde el módulo de Bancos.',
  iva: 'Elimine desde el módulo de IVA.',
}

// Anulación: is_active = 0, the number stays taken. Never a physical delete.
export function voidEntry(ctx: Ctx, id: string): Entry {
  inTx(ctx, (tx) => {
    const row = loadEntry(tx, id)
    if (!row.isActive) throw new RuleError('La partida ya está anulada.', 409, 'entry_voided')
    const blocked = VOID_BLOCKED[row.source]
    if (blocked) throw new RuleError(blocked, 409, 'entry_from_other_module')
    if (row.source === 'cierre' && !can(ctx.role, 'supervise')) {
      throw new RuleError('Solo un supervisor puede anular el cierre anual.', 403, 'permission_denied')
    }
    assertPeriodOpen(tx, row.period)
    tx.db.update(e).set({ isActive: false, updatedAt: nowIso() }).where(eq(e.id, id)).run()
    auditIn(tx, 'anular', 'journal_entry', id, { period: row.period, number: row.number })
  })
  return getEntry(ctx, id)
}

// New draft with the same lines, in a target period/date.
export function copyEntry(ctx: Ctx, id: string, input: z.output<typeof copyEntryInput>): EntrySaveResult {
  const newEntryId = inTx(ctx, (tx) => {
    const row = loadEntry(tx, id)
    const type = activeEntryType(tx, input.entryTypeId ?? row.entryTypeId)
    assertDateInPeriod(input.date, input.period)
    assertPeriodOpen(tx, input.period)
    const lines = tx.db.select().from(l).where(eq(l.entryId, id)).orderBy(asc(l.lineNo)).all()
    const { number } = assignNumber(tx, input.period, type)
    const newEntryId = newId()
    const now = nowIso()
    tx.db.insert(e)
      .values({
        id: newEntryId,
        empresaId: ctx.empresaId,
        period: input.period,
        entryTypeId: type.id,
        number,
        date: input.date,
        concept: input.concept ?? row.concept,
        status: 'borrador',
        source: 'manual',
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    insertLines(
      tx,
      newEntryId,
      lines.map(({ lineNo, accountId, costCenterId, detail, debit, credit, collectDate }) => ({
        lineNo, accountId, costCenterId, detail, debit, credit, collectDate,
      })),
    )
    auditIn(tx, 'copiar', 'journal_entry', newEntryId, { from: id, period: input.period, number })
    return newEntryId
  })
  return { ...getEntry(ctx, newEntryId), numberReassigned: false }
}
