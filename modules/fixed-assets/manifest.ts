import type { ModuleManifest } from '@accounting/shared'

export const manifest: ModuleManifest = {
  id: 'fixed-assets',
  name: 'Fixed Assets',
  description: 'Track capital assets, depreciation schedules, and disposals.',
  version: '1.0.0',
  icon: 'Building2',
  alwaysOn: false,
  dependsOn: ['general-ledger'],
  navItems: [{ label: 'Fixed Assets', path: '/fixed-assets', icon: 'Building2' }],
  permissions: {
    owner: ['read', 'write', 'delete'],
    admin: ['read', 'write'],
    member: ['read'],
  },
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  pages: async () => ({ index: (await import('./pages/index.js')).default }),
}
