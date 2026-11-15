import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { can, seesAllEmpresas } from '@accounting/shared'
import { RuleError, nowIso, type CurrentUser, type Db } from '@accounting/shared/server'
import { coreEmpresaModules, coreEmpresas, coreUserEmpresas, modules } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { activeModuleIds, dependents, missingRequirements, type ModuleCatalog } from '../lib/activation.js'
import { loadOverrides } from '../lib/permissions.js'
import type { PlatformDeps } from '../middleware/module-context.js'

const toggleInput = z.object({ enabled: z.boolean() })
type Env = { Variables: { user: CurrentUser } }

// GET /api/empresa-modules/:empresaId            modules and their state for the empresa
// PUT /api/empresa-modules/:empresaId/:moduleId  { enabled } (core.modules.manage)
export function createEmpresaModulesRoute(deps: PlatformDeps, catalog: ModuleCatalog) {
  const route = new Hono<Env>()

  route.use('*', async (c, next) => {
    const me = await deps.resolveUser(c.req.raw.headers)
    if (!me) return c.json({ error: 'No autorizado.' }, 401)
    c.set('user', me)
    await next()
  })

  const checkEmpresa = (db: Db, me: CurrentUser, empresaId: string) => {
    if (!db.select({ id: coreEmpresas.id }).from(coreEmpresas).where(eq(coreEmpresas.id, empresaId)).get()) {
      throw new RuleError('La empresa no existe.', 404, 'empresa_not_found')
    }
    if (seesAllEmpresas(me.role)) return
    const grant = db.select({ u: coreUserEmpresas.userId }).from(coreUserEmpresas)
      .where(and(eq(coreUserEmpresas.userId, me.id), eq(coreUserEmpresas.empresaId, empresaId))).get()
    if (!grant) throw new RuleError('No tiene acceso a esta empresa.', 403, 'empresa_forbidden')
  }

  const view = (db: Db, empresaId: string) => {
    const active = activeModuleIds(db, empresaId, catalog)
    const installed = new Set(db.select({ id: modules.id }).from(modules).where(eq(modules.isEnabled, true)).all().map((r) => r.id))
    return catalog.manifests.map((m) => ({
      id: m.id, name: m.name, alwaysOn: m.alwaysOn, installed: m.alwaysOn || installed.has(m.id),
      active: active.has(m.id), provides: Object.keys(m.provides ?? {}),
      requires: m.consumes?.required ?? [], missing: missingRequirements(m, active, catalog),
    }))
  }

  route.get('/:empresaId', (c) => {
    const db = deps.db()
    checkEmpresa(db, c.get('user'), c.req.param('empresaId'))
    return c.json(view(db, c.req.param('empresaId')))
  })

  route.put('/:empresaId/:moduleId', async (c) => {
    const me = c.get('user')
    const db = deps.db()
    const { empresaId, moduleId } = c.req.param()
    checkEmpresa(db, me, empresaId)
    if (!can(me.role, 'core.modules.manage', { overrides: loadOverrides(db, me.id, null) })) {
      throw new RuleError('No tiene permiso para esta acción.', 403, 'forbidden')
    }
    const { enabled } = toggleInput.parse(await c.req.json())
    const m = catalog.manifests.find((x) => x.id === moduleId)
    if (!m) throw new RuleError('El módulo no está instalado.', 404, 'module_not_found')
    if (m.alwaysOn) throw new RuleError('Este módulo siempre está activo.', 409, 'module_always_on')
    const active = activeModuleIds(db, empresaId, catalog)
    if (enabled) {
      if (!view(db, empresaId).find((x) => x.id === moduleId)?.installed) {
        throw new RuleError('El módulo no está habilitado en esta instalación.', 409, 'module_not_installed')
      }
      const missing = missingRequirements(m, active, catalog)
      if (missing.length) {
        throw new RuleError(`Primero active los módulos que proveen: ${missing.join(', ')}.`, 409, 'module_requires')
      }
    } else {
      const deps2 = dependents(moduleId, active, catalog)
      if (deps2.length) {
        throw new RuleError(`No se puede desactivar: lo necesitan ${deps2.join(', ')}.`, 409, 'module_required_by')
      }
    }
    db.transaction((tx) => {
      tx.insert(coreEmpresaModules)
        .values({ empresaId, moduleId, isEnabled: enabled, updatedBy: me.id, updatedAt: nowIso() })
        .onConflictDoUpdate({
          target: [coreEmpresaModules.empresaId, coreEmpresaModules.moduleId],
          set: { isEnabled: enabled, updatedBy: me.id, updatedAt: nowIso() },
        })
        .run()
      writeAudit(tx, { userId: me.id, empresaId }, {
        module: 'core', action: enabled ? 'activar-modulo' : 'desactivar-modulo', entity: 'modulo', entityId: moduleId,
      })
    })
    return c.json(view(db, empresaId))
  })

  return route
}
