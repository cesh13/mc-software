import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { RuleError, newId, nowIso } from '@accounting/shared/server'
import { costCenterInput, costCenterUpdate, type CostCenter } from '@accounting/shared'
import type { z } from 'zod'
import { glCostCenters, glJournalEntries, glJournalLines } from '../schema.js'
import { auditIn, inTx, type Ctx } from '../lib/context.js'

const cols = {
  id: glCostCenters.id,
  code: glCostCenters.code,
  name: glCostCenters.name,
  isActive: glCostCenters.isActive,
}

export function listCostCenters(ctx: Ctx, includeInactive: boolean): CostCenter[] {
  const where = includeInactive
    ? eq(glCostCenters.empresaId, ctx.empresaId)
    : and(eq(glCostCenters.empresaId, ctx.empresaId), eq(glCostCenters.isActive, true))
  return ctx.db.select(cols).from(glCostCenters).where(where).orderBy(asc(glCostCenters.code)).all()
}

export function findCostCenter(ctx: Ctx, id: string): CostCenter | undefined {
  return ctx.db
    .select(cols)
    .from(glCostCenters)
    .where(and(eq(glCostCenters.id, id), eq(glCostCenters.empresaId, ctx.empresaId)))
    .get()
}

export function getCostCenter(ctx: Ctx, id: string): CostCenter {
  const row = findCostCenter(ctx, id)
  if (!row) throw new RuleError('El centro de costo no existe.', 404, 'cost_center_not_found')
  return row
}

function assertCodeFree(ctx: Ctx, code: string, exceptId?: string) {
  const conds = [eq(glCostCenters.empresaId, ctx.empresaId), eq(glCostCenters.code, code)]
  if (exceptId) conds.push(ne(glCostCenters.id, exceptId))
  if (ctx.db.select({ id: glCostCenters.id }).from(glCostCenters).where(and(...conds)).get()) {
    throw new RuleError(`Ya existe el centro de costo ${code}.`, 409, 'cost_center_code_taken')
  }
}

export function createCostCenter(ctx: Ctx, input: z.output<typeof costCenterInput>): CostCenter {
  assertCodeFree(ctx, input.code)
  const id = newId()
  const now = nowIso()
  inTx(ctx, (tx) => {
    tx.db.insert(glCostCenters)
      .values({ id, empresaId: ctx.empresaId, ...input, createdAt: now, updatedAt: now })
      .run()
    auditIn(tx, 'crear', 'cost_center', id, input)
  })
  return getCostCenter(ctx, id)
}

function linesUsing(ctx: Ctx, id: string): number {
  const row = ctx.db
    .select({ n: sql<number>`count(*)` })
    .from(glJournalLines)
    .innerJoin(glJournalEntries, eq(glJournalEntries.id, glJournalLines.entryId))
    .where(
      and(
        eq(glJournalLines.costCenterId, id),
        eq(glJournalEntries.empresaId, ctx.empresaId),
        eq(glJournalEntries.isActive, true),
      ),
    )
    .get()
  return row?.n ?? 0
}

export function updateCostCenter(
  ctx: Ctx,
  id: string,
  input: z.output<typeof costCenterUpdate>,
): CostCenter {
  const before = getCostCenter(ctx, id)
  if (input.code && input.code !== before.code) assertCodeFree(ctx, input.code, id)
  if (input.isActive === false && before.isActive) assertUnused(ctx, id)
  inTx(ctx, (tx) => {
    tx.db.update(glCostCenters).set({ ...input, updatedAt: nowIso() }).where(eq(glCostCenters.id, id)).run()
    auditIn(tx, 'modificar', 'cost_center', id, { before, changes: input })
  })
  return getCostCenter(ctx, id)
}

function assertUnused(ctx: Ctx, id: string) {
  const used = linesUsing(ctx, id)
  if (used > 0) {
    throw new RuleError(
      `El centro de costo tiene ${used} movimientos; no se puede desactivar.`,
      409,
      'cost_center_in_use',
    )
  }
}

export function deactivateCostCenter(ctx: Ctx, id: string): CostCenter {
  const before = getCostCenter(ctx, id)
  if (!before.isActive) return before
  assertUnused(ctx, id)
  inTx(ctx, (tx) => {
    tx.db.update(glCostCenters)
      .set({ isActive: false, updatedAt: nowIso() })
      .where(eq(glCostCenters.id, id))
      .run()
    auditIn(tx, 'desactivar', 'cost_center', id)
  })
  return getCostCenter(ctx, id)
}
