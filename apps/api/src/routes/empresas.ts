import { Hono } from 'hono'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { can, seesAllEmpresas } from '@accounting/shared'
import { RuleError, newId, nowIso, type CurrentUser } from '@accounting/shared/server'
import { coreEmpresas, coreUserEmpresas } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import type { PlatformDeps } from '../middleware/module-context.js'

const empresaInput = z.object({
  name: z.string().trim().min(1).max(120),
  siglas: z.string().trim().min(1).max(10).toUpperCase(),
  moneda: z.string().trim().length(3).toUpperCase().default('USD'),
  granContribuyente: z.boolean().default(false),
  consolidaEnId: z.string().nullable().default(null),
})

type Env = { Variables: { user: CurrentUser } }

// Empresas a user may work in, and their administration (owner/supervisor).
export function createEmpresasRoute(deps: PlatformDeps) {
  const route = new Hono<Env>()

  route.use('*', async (c, next) => {
    const user = await deps.resolveUser(c.req.raw.headers)
    if (!user) return c.json({ error: 'No autorizado.' }, 401)
    c.set('user', user)
    await next()
  })

  const requireSupervise = (user: CurrentUser) => {
    if (!can(user.role, 'supervise')) throw new RuleError('No tiene permiso para esta acción.', 403)
  }

  // Empresas the current user can pick at login.
  route.get('/', (c) => {
    const db = deps.db()
    const user = c.get('user')
    if (seesAllEmpresas(user.role)) {
      return c.json(db.select().from(coreEmpresas).orderBy(coreEmpresas.name).all())
    }
    const ids = db
      .select({ id: coreUserEmpresas.empresaId })
      .from(coreUserEmpresas)
      .where(eq(coreUserEmpresas.userId, user.id))
      .all()
      .map((r) => r.id)
    if (ids.length === 0) return c.json([])
    return c.json(
      db.select().from(coreEmpresas).where(inArray(coreEmpresas.id, ids)).orderBy(coreEmpresas.name).all(),
    )
  })

  route.post('/', async (c) => {
    const user = c.get('user')
    requireSupervise(user)
    const input = empresaInput.parse(await c.req.json())
    const db = deps.db()
    const dup = db.select().from(coreEmpresas).where(eq(coreEmpresas.siglas, input.siglas)).get()
    if (dup) throw new RuleError('Ya existe una empresa con esas siglas.', 409)
    const id = newId()
    const now = nowIso()
    db.transaction((tx) => {
      tx.insert(coreEmpresas).values({ id, ...input, createdAt: now, updatedAt: now }).run()
      writeAudit(tx, { userId: user.id, empresaId: id }, {
        module: 'core', action: 'crear', entity: 'empresa', entityId: id, detail: input,
      })
    })
    return c.json(db.select().from(coreEmpresas).where(eq(coreEmpresas.id, id)).get(), 201)
  })

  route.patch('/:id', async (c) => {
    const user = c.get('user')
    requireSupervise(user)
    const id = c.req.param('id')
    const input = empresaInput.partial().extend({ isActive: z.boolean().optional() }).parse(await c.req.json())
    const db = deps.db()
    if (!db.select().from(coreEmpresas).where(eq(coreEmpresas.id, id)).get()) {
      throw new RuleError('La empresa no existe.', 404)
    }
    db.transaction((tx) => {
      tx.update(coreEmpresas).set({ ...input, updatedAt: nowIso() }).where(eq(coreEmpresas.id, id)).run()
      writeAudit(tx, { userId: user.id, empresaId: id }, {
        module: 'core', action: 'modificar', entity: 'empresa', entityId: id, detail: input,
      })
    })
    return c.json(db.select().from(coreEmpresas).where(eq(coreEmpresas.id, id)).get())
  })

  // Replace the list of users allowed to work in an empresa (legacy USREMP).
  route.put('/:id/users', async (c) => {
    const user = c.get('user')
    requireSupervise(user)
    const id = c.req.param('id')
    const { userIds } = z.object({ userIds: z.array(z.string()) }).parse(await c.req.json())
    const db = deps.db()
    db.transaction((tx) => {
      tx.delete(coreUserEmpresas).where(eq(coreUserEmpresas.empresaId, id)).run()
      for (const userId of userIds) {
        tx.insert(coreUserEmpresas).values({ userId, empresaId: id, createdAt: nowIso() }).run()
      }
      writeAudit(tx, { userId: user.id, empresaId: id }, {
        module: 'core', action: 'asignar-usuarios', entity: 'empresa', entityId: id, detail: { userIds },
      })
    })
    return c.json({ success: true })
  })

  route.get('/:id/users', (c) => {
    requireSupervise(c.get('user'))
    const rows = deps
      .db()
      .select({ userId: coreUserEmpresas.userId })
      .from(coreUserEmpresas)
      .where(eq(coreUserEmpresas.empresaId, c.req.param('id')))
      .all()
    return c.json(rows.map((r) => r.userId))
  })

  return route
}
