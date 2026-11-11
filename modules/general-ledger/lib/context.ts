import type { Context } from 'hono'
import type { Db, ModuleEnv } from '@accounting/shared/server'

export const MODULE = 'general-ledger'

// What a service needs from the request: database, empresa and caller.
export type Ctx = {
  db: Db
  empresaId: string
  userId: string
  role: string
  audit: ModuleEnv['Variables']['audit']
}

export function ctxOf(c: Context<ModuleEnv>): Ctx {
  return {
    db: c.get('db'),
    empresaId: c.get('empresaId'),
    userId: c.get('user').id,
    role: c.get('user').role,
    audit: c.get('audit'),
  }
}

// Runs `fn` in one synchronous transaction, handing it a Ctx bound to `tx`.
export function inTx<T>(ctx: Ctx, fn: (tx: Ctx) => T): T {
  return ctx.db.transaction((tx) => fn({ ...ctx, db: tx as unknown as Db }))
}

export function auditIn(ctx: Ctx, action: string, entity: string, entityId: string, detail?: unknown) {
  ctx.audit({ module: MODULE, action, entity, entityId, detail }, ctx.db)
}
