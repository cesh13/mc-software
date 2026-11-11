import { eq } from 'drizzle-orm'
import { RuleError, newId, nowIso } from '@accounting/shared/server'
import type { EntrySaveResult, entryInput } from '@accounting/shared'
import type { z } from 'zod'
import { glJournalEntries as e, glJournalLines as l } from '../schema.js'
import { totalsOf } from '../lib/cents.js'
import { auditIn, inTx, type Ctx } from '../lib/context.js'
import { validateLines, type NormalizedLine } from './entry-lines.js'
import { getEntry, loadEntry, type EntryRow } from './entry-detail.js'
import { activeEntryType, assertDateInPeriod, assertEditable, unbalancedError } from './entry-rules.js'
import { assertPeriodOpen } from './periods.js'
import { assignNumber, isNumberTaken, padNumber } from './numbering.js'
import { getEntryType } from './entry-types.js'

export type EntryData = z.output<typeof entryInput>

export function insertLines(ctx: Ctx, entryId: string, lines: NormalizedLine[]): void {
  // Chunked to stay below SQLite's bound-parameter limit.
  for (let i = 0; i < lines.length; i += 500) {
    const chunk = lines.slice(i, i + 500)
    ctx.db.insert(l).values(chunk.map((line) => ({ id: newId(), entryId, ...line }))).run()
  }
}

// Snapshot stored in the audit trail before an entry changes.
export function snapshot(ctx: Ctx, row: EntryRow) {
  const lines = ctx.db.select().from(l).where(eq(l.entryId, row.id)).all()
  return {
    period: row.period,
    entryTypeId: row.entryTypeId,
    number: row.number,
    date: row.date,
    concept: row.concept,
    status: row.status,
    lines: lines.map((x) => ({
      accountId: x.accountId, costCenterId: x.costCenterId, detail: x.detail, debit: x.debit, credit: x.credit,
    })),
  }
}

export function createEntry(ctx: Ctx, input: EntryData): EntrySaveResult {
  const { id, reassigned } = inTx(ctx, (tx) => {
    const type = activeEntryType(tx, input.entryTypeId)
    assertDateInPeriod(input.date, input.period)
    assertPeriodOpen(tx, input.period)
    const lines = validateLines(tx, input.lines, input.concept, input.allowZeroLines)
    const totals = totalsOf(lines)
    if (input.status === 'aplicada' && !totals.balanced) throw unbalancedError(totals)

    const { number, reassigned } = assignNumber(tx, input.period, type, input.number)
    const id = newId()
    const now = nowIso()
    tx.db.insert(e)
      .values({
        id,
        empresaId: ctx.empresaId,
        period: input.period,
        entryTypeId: type.id,
        number,
        date: input.date,
        concept: input.concept,
        status: input.status,
        source: 'manual',
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    insertLines(tx, id, lines)
    auditIn(tx, 'crear', 'journal_entry', id, {
      period: input.period, type: type.code, number, status: input.status, totals,
    })
    return { id, reassigned }
  })
  return { ...getEntry(ctx, id), numberReassigned: reassigned }
}

function numberForUpdate(ctx: Ctx, row: EntryRow, input: EntryData) {
  const type = row.entryTypeId === input.entryTypeId
    ? getEntryType(ctx, input.entryTypeId)
    : activeEntryType(ctx, input.entryTypeId)
  const samePlace = row.period === input.period && row.entryTypeId === input.entryTypeId
  if (!samePlace) return assignNumber(ctx, input.period, type, input.number ?? row.number)
  if (input.number === undefined || Number(input.number) === Number(row.number)) {
    return { number: row.number, reassigned: false }
  }
  const value = Number(input.number)
  if (value <= 0 || isNumberTaken(ctx, input.period, type.id, value, row.id)) {
    throw new RuleError(`El número ${input.number} ya está asignado.`, 409, 'number_taken')
  }
  return { number: padNumber(value, type.numberWidth), reassigned: false }
}

// Replaces header and lines. Allowed while the entry is active, editable by
// source and both its old and new periods are open.
export function updateEntry(ctx: Ctx, id: string, input: EntryData): EntrySaveResult {
  const reassigned = inTx(ctx, (tx) => {
    const row = loadEntry(tx, id)
    assertEditable(row)
    assertPeriodOpen(tx, row.period)
    assertDateInPeriod(input.date, input.period)
    if (input.period !== row.period) assertPeriodOpen(tx, input.period)
    const lines = validateLines(tx, input.lines, input.concept, input.allowZeroLines)
    const totals = totalsOf(lines)

    // An imported unbalanced entry may stay applied and flagged until it balances.
    let importedUnbalanced = false
    if (input.status === 'aplicada' && !totals.balanced) {
      if (!(row.source === 'importado' && row.importedUnbalanced)) throw unbalancedError(totals)
      importedUnbalanced = true
    }

    const { number, reassigned } = numberForUpdate(tx, row, input)
    const before = snapshot(tx, row)
    tx.db.update(e)
      .set({
        period: input.period,
        entryTypeId: input.entryTypeId,
        number,
        date: input.date,
        concept: input.concept,
        status: input.status,
        importedUnbalanced,
        updatedAt: nowIso(),
      })
      .where(eq(e.id, id))
      .run()
    // Lines are part of the entry document: replaced as a whole, the
    // previous version stays in the audit trail.
    tx.db.delete(l).where(eq(l.entryId, id)).run()
    insertLines(tx, id, lines)
    auditIn(tx, 'modificar', 'journal_entry', id, { before, number, status: input.status, totals })
    return reassigned
  })
  return { ...getEntry(ctx, id), numberReassigned: reassigned }
}
