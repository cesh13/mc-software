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
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  // Screens live in apps/web (static export cannot load module pages at runtime).
  pages: async () => ({}),
}
