import type { ModuleManifest } from '@accounting/shared'

export const manifest: ModuleManifest = {
  id: 'inventory',
  name: 'Inventory',
  description: 'Track stock items, quantities, and valuations.',
  version: '1.0.0',
  icon: 'Package',
  alwaysOn: false,
  dependsOn: ['chart-of-accounts'],
  navItems: [{ label: 'Inventory', path: '/inventory', icon: 'Package' }],
  permissions: {
    owner: ['read', 'write', 'delete'],
    admin: ['read', 'write'],
    member: ['read'],
  },
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  pages: async () => ({ index: (await import('./pages/index.js')).default }),
}
