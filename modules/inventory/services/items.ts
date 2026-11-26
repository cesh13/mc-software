import { and, asc, eq, like, or } from 'drizzle-orm'
import type { z } from 'zod'
import type { Item, itemInput, itemListQuery, itemUpdate } from '@accounting/shared'
import { newId, nowIso, RuleError } from '@accounting/shared/server'
import { invGroups as g, invItems as i, invMovements as m } from '../schema.js'
import { auditIn, inTx, type Ctx } from '../lib/context.js'
import { assertAccount, duplicate, isUniqueViolation, notFound } from './common.js'

type ItemRow = typeof i.$inferSelect

const cols = {
  id: i.id, code: i.code, name: i.name, groupId: i.groupId, unit: i.unit, barcode: i.barcode,
  isService: i.isService, tracksLots: i.tracksLots, minQty: i.minQty, maxQty: i.maxQty,
  inventoryAccountId: i.inventoryAccountId, cogsAccountId: i.cogsAccountId, isActive: i.isActive,
  groupCode: g.code, groupName: g.name,
}

function select(ctx: Ctx) {
  return ctx.db.select(cols).from(i).leftJoin(g, eq(g.id, i.groupId))
}

export function listItems(ctx: Ctx, q: z.output<typeof itemListQuery>): Item[] {
  const conds = [eq(i.empresaId, ctx.empresaId)]
  if (q.inactive !== '1') conds.push(eq(i.isActive, true))
  if (q.groupId) conds.push(eq(i.groupId, q.groupId))
  if (q.q) {
    const pattern = `%${q.q}%`
    conds.push(or(like(i.code, pattern), like(i.name, pattern), eq(i.barcode, q.q))!)
  }
  return select(ctx).where(and(...conds)).orderBy(asc(i.code)).all()
}

export function getItem(ctx: Ctx, id: string): Item {
  const row = select(ctx).where(and(eq(i.id, id), eq(i.empresaId, ctx.empresaId))).get()
  if (!row) throw notFound('El producto')
  return row
}

export function itemRow(ctx: Ctx, id: string): ItemRow | undefined {
  return ctx.db.select().from(i).where(and(eq(i.id, id), eq(i.empresaId, ctx.empresaId))).get()
}

export function itemByCode(ctx: Ctx, code: string): ItemRow | undefined {
  return ctx.db.select().from(i).where(and(eq(i.code, code.toUpperCase()), eq(i.empresaId, ctx.empresaId))).get()
}

function hasMovements(ctx: Ctx, id: string): boolean {
  return !!ctx.db.select({ id: m.id }).from(m).where(eq(m.itemId, id)).limit(1).get()
}

function validate(ctx: Ctx, v: Partial<z.output<typeof itemInput>>, existing?: ItemRow): void {
  if (v.groupId) {
    const group = ctx.db.select().from(g).where(and(eq(g.id, v.groupId), eq(g.empresaId, ctx.empresaId))).get()
    if (!group) throw new RuleError('El grupo no existe.', 400, 'group_invalid')
  }
  assertAccount(ctx, v.inventoryAccountId, 'cuenta de inventario')
  assertAccount(ctx, v.cogsAccountId, 'cuenta de costo')
  if (existing && hasMovements(ctx, existing.id)) {
    if (v.isService !== undefined && v.isService !== existing.isService) {
      throw new RuleError('El producto ya tiene movimientos: no se puede cambiar si es servicio.', 409, 'item_locked')
    }
    if (v.tracksLots !== undefined && v.tracksLots !== existing.tracksLots) {
      throw new RuleError('El producto ya tiene movimientos: no se puede cambiar el manejo de lotes.', 409, 'item_locked')
    }
  }
}

export function createItem(ctx: Ctx, input: z.output<typeof itemInput>, legacyKey?: string): Item {
  validate(ctx, input)
  const id = newId()
  const now = nowIso()
  inTx(ctx, (tx) => {
    try {
      tx.db.insert(i).values({
        ...input, minQty: input.minQty ?? null, maxQty: input.maxQty ?? null,
        id, empresaId: tx.empresaId, legacyKey: legacyKey ?? null, createdAt: now, updatedAt: now,
      }).run()
    } catch (e) {
      if (isUniqueViolation(e)) throw duplicate('un producto', input.code)
      throw e
    }
    auditIn(tx, 'crear', 'producto', id, input)
  })
  return getItem(ctx, id)
}

export function updateItem(ctx: Ctx, id: string, input: z.output<typeof itemUpdate>): Item {
  const before = itemRow(ctx, id)
  if (!before) throw notFound('El producto')
  validate(ctx, input, before)
  inTx(ctx, (tx) => {
    try {
      tx.db.update(i).set({ ...input, updatedAt: nowIso() }).where(eq(i.id, id)).run()
    } catch (e) {
      if (isUniqueViolation(e)) throw duplicate('un producto', input.code ?? before.code)
      throw e
    }
    auditIn(tx, 'modificar', 'producto', id, { before, after: input })
  })
  return getItem(ctx, id)
}

export function setItemActive(ctx: Ctx, id: string, active: boolean): Item {
  const row = itemRow(ctx, id)
  if (!row) throw notFound('El producto')
  if (row.isActive === active) {
    throw new RuleError(`El producto ya está ${active ? 'activo' : 'inactivo'}.`, 409, active ? 'already_active' : 'already_inactive')
  }
  inTx(ctx, (tx) => {
    tx.db.update(i).set({ isActive: active, updatedAt: nowIso() }).where(eq(i.id, id)).run()
    auditIn(tx, active ? 'reactivar' : 'desactivar', 'producto', id)
  })
  return getItem(ctx, id)
}
