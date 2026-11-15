import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { listSettingDefs, settingDef } from '@accounting/shared'
import { RuleError, requirePermission, type ModuleEnv, type ServiceContext } from '@accounting/shared/server'
import { settingsService } from '../core/settings.js'
import { moduleContext, type PlatformDeps } from '../middleware/module-context.js'

const setInput = z.object({
  namespace: z.string().min(1),
  key: z.string().min(1),
  value: z.unknown(),
  validFrom: z.string().optional(),
})

const ctxOf = (c: Context<ModuleEnv>): ServiceContext => ({
  db: c.get('db'), empresaId: c.get('empresaId'), userId: c.get('user').id, role: c.get('user').role, audit: c.get('audit'),
})

// Settings of the active empresa (X-Empresa-Id). Reading needs only access to
// the empresa; changing needs core.settings.manage.
//   GET /api/empresa-settings?namespace=…   declared settings with their value in force
//   GET /api/empresa-settings/history?namespace=…&key=…
//   PUT /api/empresa-settings                { namespace, key, value, validFrom? }
export function createEmpresaSettingsRoute(deps: PlatformDeps) {
  const route = new Hono<ModuleEnv>()
  route.use('*', moduleContext(deps))

  route.get('/', (c) => {
    const svc = settingsService(ctxOf(c))
    const namespace = c.req.query('namespace')
    return c.json(listSettingDefs(namespace).map((d) => ({
      namespace: d.namespace, key: d.key, label: d.label, dated: !!d.dated,
      value: svc.get(d.namespace, d.key), default: d.default,
    })))
  })

  route.get('/history', (c) => {
    const namespace = c.req.query('namespace') ?? ''
    const key = c.req.query('key') ?? ''
    if (!settingDef(namespace, key)) throw new RuleError('Configuración desconocida.', 404, 'setting_unknown')
    return c.json(settingsService(ctxOf(c)).history(namespace, key))
  })

  route.put('/', requirePermission('core.settings.manage'), async (c) => {
    const input = setInput.parse(await c.req.json())
    const ctx = ctxOf(c)
    const saved = ctx.db.transaction((tx) =>
      settingsService({ ...ctx, db: tx as unknown as ServiceContext['db'] }).set(input.namespace, input.key, input.value, input.validFrom),
    )
    return c.json(saved)
  })

  return route
}
