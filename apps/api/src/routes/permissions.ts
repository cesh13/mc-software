import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { can, effectivePermissions, listPermissions, permissionDef, rolePackages } from '@accounting/shared'
import { RuleError, newId, nowIso, type CurrentUser } from '@accounting/shared/server'
import { coreEmpresas, corePermissionOverrides as o, user as userTable } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { loadOverrides } from '../lib/permissions.js'
import type { PlatformDeps } from '../middleware/module-context.js'

const overridesInput = z.object({
  overrides: z.array(z.object({
    permission: z.string().min(1),
    effect: z.enum(['grant', 'deny']),
    empresaId: z.string().min(1).nullable().default(null),
  })).max(2000),
})

type Env = { Variables: { user: CurrentUser } }

// GET  /api/permissions/me?empresa=…   effective permissions of the caller
// GET  /api/permissions/catalog        every permission, grouped by the web
// GET  /api/permissions/users/:id      overrides + effective set of a user
// PUT  /api/permissions/users/:id      replace a user's overrides
export function createPermissionsRoute(deps: PlatformDeps) {
  const route = new Hono<Env>()

  route.use('*', async (c, next) => {
    const me = await deps.resolveUser(c.req.raw.headers)
    if (!me) return c.json({ error: 'No autorizado.' }, 401)
    c.set('user', me)
    await next()
  })

  const requireManage = (me: CurrentUser) => {
    if (!can(me.role, 'core.users.manage', { overrides: loadOverrides(deps.db(), me.id, null) })) {
      throw new RuleError('No tiene permiso para esta acción.', 403, 'forbidden')
    }
  }

  route.get('/me', (c) => {
    const me = c.get('user')
    const empresaId = c.req.query('empresa') ?? null
    const overrides = loadOverrides(deps.db(), me.id, empresaId)
    return c.json({
      role: me.role,
      packages: rolePackages(me.role),
      empresaId,
      permissions: effectivePermissions(me.role, { overrides, empresaId }),
    })
  })

  route.get('/catalog', (c) => c.json(listPermissions()))

  route.get('/users/:id', (c) => {
    requireManage(c.get('user'))
    const db = deps.db()
    const target = db.select({ id: userTable.id, role: userTable.role }).from(userTable)
      .where(eq(userTable.id, c.req.param('id'))).get()
    if (!target) throw new RuleError('El usuario no existe.', 404, 'usuario_no_existe')
    const empresaId = c.req.query('empresa') ?? null
    const overrides = loadOverrides(db, target.id)
    return c.json({
      userId: target.id,
      role: target.role,
      overrides,
      effective: effectivePermissions(target.role, { overrides, empresaId }),
    })
  })

  route.put('/users/:id', async (c) => {
    const me = c.get('user')
    requireManage(me)
    const { overrides } = overridesInput.parse(await c.req.json())
    const db = deps.db()
    const target = db.select({ id: userTable.id, role: userTable.role }).from(userTable)
      .where(eq(userTable.id, c.req.param('id'))).get()
    if (!target) throw new RuleError('El usuario no existe.', 404, 'usuario_no_existe')
    if (target.role === 'owner' && me.role !== 'owner') {
      throw new RuleError('Solo un propietario puede administrar a un propietario.', 403, 'solo_propietario')
    }
    if (target.id === me.id) throw new RuleError('No puede cambiar sus propios permisos.', 403, 'propios_permisos')
    const unique = new Map(overrides.map((x) => [`${x.permission}|${x.empresaId ?? ''}`, x]))
    const empresas = new Set(db.select({ id: coreEmpresas.id }).from(coreEmpresas).all().map((r) => r.id))
    for (const x of unique.values()) {
      if (!permissionDef(x.permission)) throw new RuleError(`Permiso desconocido: ${x.permission}.`, 400, 'permiso_desconocido')
      if (x.empresaId && !empresas.has(x.empresaId)) throw new RuleError('Alguna empresa no existe.', 400, 'empresa_no_existe')
      if (target.role === 'owner' && x.effect === 'deny') {
        throw new RuleError('A un propietario no se le pueden negar permisos.', 409, 'propietario_sin_negar')
      }
    }
    const before = loadOverrides(db, target.id)
    db.transaction((tx) => {
      tx.delete(o).where(eq(o.userId, target.id)).run()
      for (const x of unique.values()) {
        tx.insert(o).values({ id: newId(), userId: target.id, ...x, createdBy: me.id, createdAt: nowIso() }).run()
      }
      writeAudit(tx, { userId: me.id, empresaId: null }, {
        module: 'core', action: 'permisos', entity: 'usuario', entityId: target.id,
        detail: { before, after: [...unique.values()] },
      })
    })
    return c.json({ userId: target.id, role: target.role, overrides: loadOverrides(db, target.id) })
  })

  return route
}
