import { and, asc, eq, ne } from 'drizzle-orm'
import { RuleError, newId, nowIso } from '@accounting/shared/server'
import { entryTypeInput, entryTypeUpdate, type EntryType } from '@accounting/shared'
import { glEntryTypes } from '../schema.js'
import { auditIn, inTx, type Ctx } from '../lib/context.js'
import type { z } from 'zod'

const cols = {
  id: glEntryTypes.id,
  code: glEntryTypes.code,
  name: glEntryTypes.name,
  isBank: glEntryTypes.isBank,
  numberWidth: glEntryTypes.numberWidth,
  isActive: glEntryTypes.isActive,
}

export function listEntryTypes(ctx: Ctx, includeInactive: boolean): EntryType[] {
  const where = includeInactive
    ? eq(glEntryTypes.empresaId, ctx.empresaId)
    : and(eq(glEntryTypes.empresaId, ctx.empresaId), eq(glEntryTypes.isActive, true))
  return ctx.db.select(cols).from(glEntryTypes).where(where).orderBy(asc(glEntryTypes.code)).all()
}

export function getEntryType(ctx: Ctx, id: string): EntryType {
  const row = ctx.db
    .select(cols)
    .from(glEntryTypes)
    .where(and(eq(glEntryTypes.id, id), eq(glEntryTypes.empresaId, ctx.empresaId)))
    .get()
  if (!row) throw new RuleError('El tipo de partida no existe.', 404, 'entry_type_not_found')
  return row
}

function assertCodeFree(ctx: Ctx, code: string, exceptId?: string) {
  const conds = [eq(glEntryTypes.empresaId, ctx.empresaId), eq(glEntryTypes.code, code)]
  if (exceptId) conds.push(ne(glEntryTypes.id, exceptId))
  if (ctx.db.select({ id: glEntryTypes.id }).from(glEntryTypes).where(and(...conds)).get()) {
    throw new RuleError(`Ya existe el tipo de partida ${code}.`, 409, 'entry_type_code_taken')
  }
}

export function createEntryType(ctx: Ctx, input: z.output<typeof entryTypeInput>): EntryType {
  assertCodeFree(ctx, input.code)
  const id = newId()
  const now = nowIso()
  inTx(ctx, (tx) => {
    tx.db.insert(glEntryTypes)
      .values({ id, empresaId: ctx.empresaId, ...input, createdAt: now, updatedAt: now })
      .run()
    auditIn(tx, 'crear', 'entry_type', id, input)
  })
  return getEntryType(ctx, id)
}

export function updateEntryType(
  ctx: Ctx,
  id: string,
  input: z.output<typeof entryTypeUpdate>,
): EntryType {
  const before = getEntryType(ctx, id)
  if (input.code && input.code !== before.code) assertCodeFree(ctx, input.code, id)
  inTx(ctx, (tx) => {
    tx.db.update(glEntryTypes).set({ ...input, updatedAt: nowIso() }).where(eq(glEntryTypes.id, id)).run()
    auditIn(tx, 'modificar', 'entry_type', id, { before, changes: input })
  })
  return getEntryType(ctx, id)
}

export function deactivateEntryType(ctx: Ctx, id: string): EntryType {
  const before = getEntryType(ctx, id)
  if (!before.isActive) return before
  inTx(ctx, (tx) => {
    tx.db.update(glEntryTypes)
      .set({ isActive: false, updatedAt: nowIso() })
      .where(eq(glEntryTypes.id, id))
      .run()
    auditIn(tx, 'desactivar', 'entry_type', id)
  })
  return getEntryType(ctx, id)
}
