import { Hono } from 'hono'
import type { ModuleManifest } from '@accounting/shared'
import { requirePermission, type ModuleEnv, type ServiceContext } from '@accounting/shared/server'

// In-memory modules for contract tests: a provider of the "echo" service and
// a consumer that requires it and optionally uses "absent".
export type Echo = { say(text: string): string }

const ctxOf = (c: { get: (k: never) => unknown }): ServiceContext => {
  const get = c.get as (k: string) => never
  return { db: get('db'), empresaId: get('empresaId'), userId: (get('user') as { id: string }).id,
    role: (get('user') as { role: string }).role, audit: get('audit') }
}

const base = {
  description: 'test', version: '0.0.0', icon: 'Box', navItems: [],
  schema: async () => ({}), pages: async () => ({}),
}

export const providerManifest: ModuleManifest = {
  ...base, id: 'test-provider', name: 'Test provider', alwaysOn: false, dependsOn: [],
  permissions: [{ id: 'tp.ping.view', label: 'ping', group: 'test', packages: ['reports'] }],
  provides: { echo: async () => (ctx: ServiceContext): Echo => ({ say: (t) => `${ctx.empresaId}:${t}` }) },
  router: async () => new Hono<ModuleEnv>().get('/ping', requirePermission('tp.ping.view'), (c) => c.json({ ok: true })),
}

export const consumerManifest: ModuleManifest = {
  ...base, id: 'test-consumer', name: 'Test consumer', alwaysOn: false, dependsOn: [],
  permissions: [{ id: 'tc.ping.view', label: 'ping', group: 'test', packages: ['reports'] }],
  consumes: { required: ['echo'], optional: ['absent'] },
  router: async () =>
    new Hono<ModuleEnv>().get('/ping', requirePermission('tc.ping.view'), (c) => {
      const services = c.get('services')
      const ctx = ctxOf(c as never)
      return c.json({
        echo: services.require<Echo>('echo', ctx).say('hola'),
        absent: services.get('absent', ctx),
      })
    }),
}
