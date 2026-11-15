import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { and, eq } from 'drizzle-orm'
import { seesAllEmpresas } from '@accounting/shared'
import { RuleError, type CurrentUser, type Db, type ModuleEnv } from '@accounting/shared/server'
import { coreEmpresas, coreUserEmpresas } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { loadOverrides } from '../lib/permissions.js'
import { activeModuleIds, type ModuleCatalog } from '../lib/activation.js'
import { ServiceDirectory } from '../lib/services.js'

export type ResolveUser = (headers: Headers) => Promise<CurrentUser | null>

export type PlatformDeps = {
  db: () => Db
  resolveUser: ResolveUser
}

export const EMPRESA_HEADER = 'x-empresa-id'

// Which module the route belongs to, and what is loaded (to check activation
// per empresa and hand out services).
export type ModuleScope = { moduleId: string; catalog: ModuleCatalog; directory: ServiceDirectory }

// Runs before every module route: authenticates, resolves the active empresa
// from the X-Empresa-Id header, checks the user may work in it and that the
// module is active for it.
export function moduleContext(deps: PlatformDeps, scope?: ModuleScope) {
  return createMiddleware<ModuleEnv>(async (c, next) => {
    const user = await deps.resolveUser(c.req.raw.headers)
    if (!user) return c.json({ error: 'No autorizado.' }, 401)

    const empresaId = c.req.header(EMPRESA_HEADER)
    if (!empresaId) {
      return c.json({ error: 'Seleccione una empresa.', code: 'empresa_required' }, 400)
    }

    const db = deps.db()
    const empresa = db
      .select({ id: coreEmpresas.id, isActive: coreEmpresas.isActive })
      .from(coreEmpresas)
      .where(eq(coreEmpresas.id, empresaId))
      .get()
    if (!empresa || !empresa.isActive) {
      return c.json({ error: 'La empresa no existe.', code: 'empresa_not_found' }, 404)
    }

    if (!seesAllEmpresas(user.role)) {
      const grant = db
        .select({ userId: coreUserEmpresas.userId })
        .from(coreUserEmpresas)
        .where(
          and(eq(coreUserEmpresas.userId, user.id), eq(coreUserEmpresas.empresaId, empresaId)),
        )
        .get()
      if (!grant) {
        return c.json({ error: 'No tiene acceso a esta empresa.', code: 'empresa_forbidden' }, 403)
      }
    }

    const active = scope ? activeModuleIds(db, empresaId, scope.catalog) : new Set<string>()
    if (scope && !active.has(scope.moduleId)) {
      return c.json({ error: 'Este módulo no está activo para la empresa.', code: 'module_disabled' }, 403)
    }

    c.set('db', db)
    c.set('user', user)
    c.set('empresaId', empresaId)
    c.set('permissionOverrides', loadOverrides(db, user.id, empresaId))
    c.set('audit', (entry, tx) => writeAudit(tx ?? db, { userId: user.id, empresaId }, entry))
    c.set('services', scope ? scope.directory.forActive(active) : emptyServices)
    await next()
  })
}

const emptyServices = new ServiceDirectory().forActive(new Set())

// app.onError handler: business-rule and validation failures become 4xx JSON.
export function handleError(err: Error, c: Context) {
  if (err instanceof RuleError) {
    return c.json({ error: err.message, code: err.code }, err.status)
  }
  if (err.name === 'ZodError') {
    const issues = (err as unknown as { issues: { path: PropertyKey[]; message: string }[] }).issues
    return c.json(
      {
        error: 'Datos inválidos.',
        code: 'validation',
        issues: issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      400,
    )
  }
  console.error('[api] unhandled error:', err)
  return c.json({ error: 'Error interno del servidor.' }, 500)
}
