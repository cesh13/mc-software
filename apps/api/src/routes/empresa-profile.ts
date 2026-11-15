import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { can, empresaProfileInput, type EmpresaProfile } from '@accounting/shared'
import { RuleError, nowIso, type CurrentUser, type Db } from '@accounting/shared/server'
import { coreEmpresaProfile } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { requireEmpresaAccess } from '../lib/empresa-access.js'
import { loadOverrides } from '../lib/permissions.js'
import type { PlatformDeps } from '../middleware/module-context.js'

type Env = { Variables: { user: CurrentUser } }

const EMPTY = {
  legalName: '', tradeName: '', nit: '', nrc: '', giro: '', economicActivityCode: '', departmentCode: '',
  municipalityCode: '', address: '', phone: '', email: '', logoRef: null, amountsLegend: '',
}

function readProfile(db: Db, empresaId: string): EmpresaProfile {
  const row = db.select().from(coreEmpresaProfile).where(eq(coreEmpresaProfile.empresaId, empresaId)).get()
  return row ?? { ...EMPTY, empresaId, updatedBy: null, updatedAt: null }
}

// Editable fields only (what the audit trail records).
function fields(p: EmpresaProfile) {
  const { empresaId: _e, updatedBy: _u, updatedAt: _t, ...rest } = p
  return rest
}

// Fiscal profile ("ficha fiscal") of an empresa.
//   GET /api/empresa-profile/:id   anyone with access to the empresa
//   PUT /api/empresa-profile/:id   core.empresas.manage; audited with before/after
export function createEmpresaProfileRoute(deps: PlatformDeps) {
  const route = new Hono<Env>()

  route.use('*', async (c, next) => {
    const user = await deps.resolveUser(c.req.raw.headers)
    if (!user) return c.json({ error: 'No autorizado.' }, 401)
    c.set('user', user)
    await next()
  })

  route.get('/:id', (c) => {
    const id = c.req.param('id')
    const db = deps.db()
    requireEmpresaAccess(db, c.get('user'), id)
    return c.json(readProfile(db, id))
  })

  route.put('/:id', async (c) => {
    const id = c.req.param('id')
    const user = c.get('user')
    const db = deps.db()
    requireEmpresaAccess(db, user, id)
    if (!can(user.role, 'core.empresas.manage', { overrides: loadOverrides(db, user.id, id), empresaId: id })) {
      throw new RuleError('No tiene permiso para esta acción.', 403)
    }
    const input = empresaProfileInput.parse(await c.req.json())
    const before = readProfile(db, id)
    db.transaction((tx) => {
      const values = { ...input, updatedBy: user.id, updatedAt: nowIso() }
      tx.insert(coreEmpresaProfile)
        .values({ empresaId: id, ...values })
        .onConflictDoUpdate({ target: coreEmpresaProfile.empresaId, set: values })
        .run()
      writeAudit(tx, { userId: user.id, empresaId: id }, {
        module: 'core', action: 'modificar', entity: 'empresa-profile', entityId: id,
        detail: { before: before.updatedAt ? fields(before) : null, after: input },
      })
    })
    return c.json(readProfile(db, id))
  })

  return route
}
