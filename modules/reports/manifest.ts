import type { ModuleManifest } from '@accounting/shared'

export const manifest: ModuleManifest = {
  id: 'reports',
  name: 'Reports',
  description: 'Financial statements: balance sheet, income statement, cash flow.',
  version: '1.0.0',
  icon: 'BarChart3',
  alwaysOn: false,
  dependsOn: ['general-ledger'],
  navItems: [{ label: 'Reports', path: '/reports', icon: 'BarChart3' }],
  permissions: {
    owner: ['read', 'write', 'delete'],
    admin: ['read', 'write'],
    member: ['read'],
  },
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  pages: async () => ({ index: (await import('./pages/index.js')).default }),
}
