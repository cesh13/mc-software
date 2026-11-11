import { Hono } from 'hono'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { can } from '@accounting/shared'
import { RuleError, nowIso, type CurrentUser, type Db } from '@accounting/shared/server'
import { coreEmpresas, coreUserEmpresas, user as userTable } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import type { PlatformDeps } from '../middleware/module-context.js'

// `admin` and `member` are legacy aliases and are not accepted as input.
const ASSIGNABLE_ROLES = ['owner', 'supervisor', 'digitador_consulta', 'digitador', 'consulta'] as const
const roleInput = z.enum(ASSIGNABLE_ROLES, { message: 'Rol no válido.' })
const empresaIds = z.array(z.string().min(1)).transform((ids) => [...new Set(ids)])

const createInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(200),
  role: roleInput,
  empresaIds: empresaIds.default([]),
})
const patchInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: roleInput.optional(),
  banned: z.boolean().optional(),
})
const grantsInput = z.object({ empresaIds })

export type CreateAccountInput = { name: string; email: string; password: string }
export type CreateAccount = (input: CreateAccountInput) => Promise<{ id: string }>
export type UsersRouteOptions = { createAccount?: CreateAccount }

// Default: Better Auth hashes the password and creates the user + account rows.
const betterAuthCreateAccount: CreateAccount = async (input) => {
  const { getAuth } = await import('../lib/auth.js')
  const result = await getAuth().api.signUpEmail({ body: input })
  return { id: result.user.id }
}

type Env = { Variables: { user: CurrentUser } }
type Target = { id: string; role: string; banned: boolean | null }

// User administration (legacy USUARIOS / USREMP). Requires `supervise`.
export function createUsersRoute(deps: PlatformDeps, options: UsersRouteOptions = {}) {
  const createAccount = options.createAccount ?? betterAuthCreateAccount
  const route = new Hono<Env>()

  route.use('*', async (c, next) => {
    const me = await deps.resolveUser(c.req.raw.headers)
    if (!me) return c.json({ error: 'No autorizado.' }, 401)
    if (!can(me.role, 'supervise')) {
      return c.json({ error: 'No tiene permiso para esta acción.', code: 'forbidden' }, 403)
    }
    c.set('user', me)
    await next()
  })

  const findTarget = (db: Db, id: string): Target => {
    const t = db
      .select({ id: userTable.id, role: userTable.role, banned: userTable.banned })
      .from(userTable)
      .where(eq(userTable.id, id))
      .get()
    if (!t) throw new RuleError('El usuario no existe.', 404, 'usuario_no_existe')
    return t
  }

  // Only an owner may touch an owner or hand out the owner role.
  const requireOwnerFor = (me: CurrentUser, ...roles: string[]) => {
    if (me.role !== 'owner' && roles.includes('owner')) {
      throw new RuleError('Solo un propietario puede administrar a un propietario.', 403, 'solo_propietario')
    }
  }

  const checkEmpresas = (db: Db, ids: string[]) => {
    if (ids.length === 0) return
    const found = db.select({ id: coreEmpresas.id }).from(coreEmpresas).where(inArray(coreEmpresas.id, ids)).all()
    if (found.length !== ids.length) throw new RuleError('Alguna empresa no existe.', 400, 'empresa_no_existe')
  }

  const replaceGrants = (tx: Db, userId: string, ids: string[]) => {
    tx.delete(coreUserEmpresas).where(eq(coreUserEmpresas.userId, userId)).run()
    for (const empresaId of ids) tx.insert(coreUserEmpresas).values({ userId, empresaId, createdAt: nowIso() }).run()
  }

  const grantsOf = (db: Db, userId: string) =>
    db.select({ id: coreUserEmpresas.empresaId }).from(coreUserEmpresas)
      .where(eq(coreUserEmpresas.userId, userId)).all().map((r) => r.id)

  const view = (db: Db, id: string) => {
    const u = db
      .select({ id: userTable.id, name: userTable.name, email: userTable.email, role: userTable.role, banned: userTable.banned })
      .from(userTable).where(eq(userTable.id, id)).get()
    return u && { ...u, banned: Boolean(u.banned), empresaIds: grantsOf(db, id) }
  }

  route.get('/', (c) => {
    const db = deps.db()
    const grants = db.select().from(coreUserEmpresas).all()
    const rows = db
      .select({ id: userTable.id, name: userTable.name, email: userTable.email, role: userTable.role, banned: userTable.banned })
      .from(userTable).orderBy(userTable.name).all()
    return c.json(
      rows.map((u) => ({
        ...u,
        banned: Boolean(u.banned),
        empresaIds: grants.filter((g) => g.userId === u.id).map((g) => g.empresaId),
      })),
    )
  })

  route.post('/', async (c) => {
    const me = c.get('user')
    const input = createInput.parse(await c.req.json())
    requireOwnerFor(me, input.role)
    const db = deps.db()
    checkEmpresas(db, input.empresaIds)
    if (db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, input.email)).get()) {
      throw new RuleError('Ya existe un usuario con ese correo.', 409, 'correo_duplicado')
    }
    let created: { id: string }
    try {
      created = await createAccount({ name: input.name, email: input.email, password: input.password })
    } catch (err) {
      if (/exist|already|duplicate|unique/i.test(String((err as Error)?.message))) {
        throw new RuleError('Ya existe un usuario con ese correo.', 409, 'correo_duplicado')
      }
      throw err
    }
    db.transaction((tx) => {
      tx.update(userTable).set({ role: input.role, updatedAt: nowIso() }).where(eq(userTable.id, created.id)).run()
      replaceGrants(tx, created.id, input.empresaIds)
      writeAudit(tx, { userId: me.id, empresaId: null }, {
        module: 'core', action: 'crear', entity: 'usuario', entityId: created.id,
        detail: { name: input.name, email: input.email, role: input.role, empresaIds: input.empresaIds },
      })
    })
    return c.json(view(db, created.id), 201)
  })

  route.patch('/:id', async (c) => {
    const me = c.get('user')
    const id = c.req.param('id')
    const input = patchInput.parse(await c.req.json())
    const db = deps.db()
    const target = findTarget(db, id)
    requireOwnerFor(me, target.role, input.role ?? target.role)

    if (id === me.id) {
      if (input.role !== undefined && input.role !== target.role) {
        throw new RuleError('No puede cambiar su propio rol.', 403, 'propio_rol')
      }
      if (input.banned === true) throw new RuleError('No puede bloquearse a sí mismo.', 403, 'propio_bloqueo')
    }
    const demotes = target.role === 'owner' && input.role !== undefined && input.role !== 'owner'
    if (demotes || (target.role === 'owner' && input.banned === true)) {
      const others = db
        .select({ id: userTable.id, banned: userTable.banned }).from(userTable)
        .where(eq(userTable.role, 'owner')).all()
        .filter((o) => o.id !== id && !o.banned)
      if (!target.banned && others.length === 0) {
        throw new RuleError('Debe quedar al menos un propietario activo.', 409, 'ultimo_propietario')
      }
    }
    db.transaction((tx) => {
      tx.update(userTable).set({ ...input, updatedAt: nowIso() }).where(eq(userTable.id, id)).run()
      writeAudit(tx, { userId: me.id, empresaId: null }, {
        module: 'core', action: input.banned === undefined ? 'modificar' : input.banned ? 'bloquear' : 'desbloquear',
        entity: 'usuario', entityId: id, detail: input,
      })
    })
    return c.json(view(db, id))
  })

  route.put('/:id/empresas', async (c) => {
    const me = c.get('user')
    const id = c.req.param('id')
    const { empresaIds: ids } = grantsInput.parse(await c.req.json())
    const db = deps.db()
    requireOwnerFor(me, findTarget(db, id).role)
    checkEmpresas(db, ids)
    db.transaction((tx) => {
      replaceGrants(tx, id, ids)
      writeAudit(tx, { userId: me.id, empresaId: null }, {
        module: 'core', action: 'asignar-empresas', entity: 'usuario', entityId: id, detail: { empresaIds: ids },
      })
    })
    return c.json(view(db, id))
  })

  return route
}
