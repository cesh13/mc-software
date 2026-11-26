import { and, asc, eq } from 'drizzle-orm'
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core'
import { newId, nowIso, RuleError } from '@accounting/shared/server'
import { auditIn, inTx, type Ctx } from '../lib/context.js'
import { duplicate, isUniqueViolation, notFound } from './common.js'

// Shared create/update/(de)activate for the small catalogs (warehouses, groups, types).
type CatalogTable = SQLiteTable & {
  id: SQLiteColumn; empresaId: SQLiteColumn; code: SQLiteColumn; isActive: SQLiteColumn
}

export type CatalogSpec<Row> = {
  table: CatalogTable
  entity: string    // audit entity
  noun: string      // 'una bodega'
  label: string     // 'La bodega'
  validate?: (ctx: Ctx, input: Record<string, unknown>, existing: Row | null) => void
  afterCreate?: (ctx: Ctx, id: string) => void
}

export function catalog<Row extends { id: string; code: string; isActive: boolean }>(spec: CatalogSpec<Row>) {
  const t = spec.table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (ctx: Ctx) => ctx.db.select().from(t as any)
  const find = (ctx: Ctx, id: string) =>
    q(ctx).where(and(eq(t.id, id), eq(t.empresaId, ctx.empresaId))).get() as Row | undefined
  const get = (ctx: Ctx, id: string): Row => {
    const row = find(ctx, id)
    if (!row) throw notFound(spec.label)
    return row
  }
  const list = (ctx: Ctx, inactive = false): Row[] => {
    const conds = [eq(t.empresaId, ctx.empresaId)]
    if (!inactive) conds.push(eq(t.isActive, true))
    return q(ctx).where(and(...conds)).orderBy(asc(t.code)).all() as Row[]
  }
  const write = (ctx: Ctx, fn: () => void, code: string) => {
    try { fn() } catch (e) {
      if (isUniqueViolation(e)) throw duplicate(spec.noun, code)
      throw e
    }
  }
  return {
    find, get, list,
    create(ctx: Ctx, input: Record<string, unknown> & { code: string }): Row {
      spec.validate?.(ctx, input, null)
      const id = newId()
      const now = nowIso()
      inTx(ctx, (tx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        write(tx, () => tx.db.insert(t).values({ ...input, id, empresaId: tx.empresaId, isActive: true, createdAt: now, updatedAt: now } as any).run(), input.code)
        spec.afterCreate?.(tx, id)
        auditIn(tx, 'crear', spec.entity, id, input)
      })
      return get(ctx, id)
    },
    update(ctx: Ctx, id: string, input: Record<string, unknown> & { code?: string }): Row {
      const before = get(ctx, id)
      spec.validate?.(ctx, input, before)
      inTx(ctx, (tx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        write(tx, () => tx.db.update(t).set({ ...input, updatedAt: nowIso() } as any).where(eq(t.id, id)).run(), input.code ?? before.code)
        auditIn(tx, 'modificar', spec.entity, id, { before, after: input })
      })
      return get(ctx, id)
    },
    setActive(ctx: Ctx, id: string, active: boolean): Row {
      const row = get(ctx, id)
      if (row.isActive === active) {
        throw new RuleError(`${spec.label} ya está ${active ? 'activa' : 'inactiva'}.`, 409, active ? 'already_active' : 'already_inactive')
      }
      inTx(ctx, (tx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx.db.update(t).set({ isActive: active, updatedAt: nowIso() } as any).where(eq(t.id, id)).run()
        auditIn(tx, active ? 'reactivar' : 'desactivar', spec.entity, id)
      })
      return get(ctx, id)
    },
  }
}
