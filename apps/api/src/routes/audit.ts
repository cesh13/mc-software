import { Hono, type Context } from 'hono'
import { can, seesAllEmpresas } from '@accounting/shared'
import { RuleError, type CurrentUser } from '@accounting/shared/server'
import { auditCsv, auditFilters, auditPaging, auditWhere, queryAudit, type AuditFilters } from '../lib/audit-query.js'
import { requireEmpresaAccess } from '../lib/empresa-access.js'
import { loadOverrides } from '../lib/permissions.js'
import { EMPRESA_HEADER, type PlatformDeps } from '../middleware/module-context.js'

type Env = { Variables: { user: CurrentUser } }

const EXPORT_MAX = 50_000

// Audit trail queries (legacy BITACORA). Needs core.audit.view.
//   GET /api/audit         ?empresaId (default X-Empresa-Id; 'all' = owners only) &userId &module
//                          &entity &entityId &from &to &q &limit(<=500) &offset, newest first
//   GET /api/audit/export  same filters, CSV (up to 50 000 rows)
export function createAuditRoute(deps: PlatformDeps) {
  const route = new Hono<Env>()

  route.use('*', async (c, next) => {
    const user = await deps.resolveUser(c.req.raw.headers)
    if (!user) return c.json({ error: 'No autorizado.' }, 401)
    c.set('user', user)
    await next()
  })

  // Resolves the empresa to read and checks access and permission for it.
  function scopeOf(c: Context<Env>): { filters: AuditFilters; scope: string | null } {
    const user = c.get('user')
    const db = deps.db()
    const filters = auditFilters.parse(c.req.query())
    const requested = filters.empresaId ?? c.req.header(EMPRESA_HEADER)
    if (!requested) throw new RuleError('Seleccione una empresa.', 400, 'empresa_required')
    if (requested === 'all') {
      if (!seesAllEmpresas(user.role)) throw new RuleError('Solo el propietario puede ver todas las empresas.', 403)
      return { filters, scope: null }
    }
    requireEmpresaAccess(db, user, requested)
    if (!can(user.role, 'core.audit.view', { overrides: loadOverrides(db, user.id, requested), empresaId: requested })) {
      throw new RuleError('No tiene permiso para esta acción.', 403)
    }
    return { filters, scope: requested }
  }

  route.get('/', (c) => {
    const { filters, scope } = scopeOf(c)
    const { limit, offset } = auditPaging.parse(c.req.query())
    const { rows, total } = queryAudit(deps.db(), auditWhere(filters, scope), limit, offset)
    return c.json({ rows, total, limit, offset })
  })

  route.get('/export', (c) => {
    const { filters, scope } = scopeOf(c)
    const { rows } = queryAudit(deps.db(), auditWhere(filters, scope), EXPORT_MAX, 0)
    return new Response(auditCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bitacora.csv"',
      },
    })
  })

  return route
}
