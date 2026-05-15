import type { ModuleManifest } from '@accounting/shared'

export const manifest: ModuleManifest = {
  id: 'payroll',
  name: 'Payroll',
  description: 'Manage employees, run payroll, and record payroll journal entries.',
  version: '1.0.0',
  icon: 'Users',
  alwaysOn: false,
  dependsOn: ['general-ledger'],
  navItems: [{ label: 'Payroll', path: '/payroll', icon: 'Users' }],
  permissions: {
    owner: ['read', 'write', 'delete'],
    admin: ['read', 'write'],
    member: ['read'],
  },
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  pages: async () => ({ index: (await import('./pages/index.js')).default }),
}
