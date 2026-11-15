import type { ModuleManifest } from '@accounting/shared'
import { PTY_PERMISSIONS } from './permissions.js'

export const manifest: ModuleManifest = {
  id: 'parties',
  name: 'Parties',
  description: 'Single master of third parties: customers and suppliers with their tax ids.',
  version: '1.0.0',
  icon: 'Users',
  alwaysOn: true,
  dependsOn: [],
  navItems: [{ label: 'Clientes y proveedores', path: '/parties', icon: 'Users' }],
  permissions: PTY_PERMISSIONS,
  // contratos.md §7: read-only lookup of third parties, bound to the caller's empresa.
  provides: {
    parties: async () => {
      const { createPartiesLookup } = await import('./services/lookup.js')
      return (ctx) => createPartiesLookup({ empresaId: ctx.empresaId })
    },
  },
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  // Screens live in apps/web (static export cannot load module pages at runtime).
  pages: async () => ({}),
}
