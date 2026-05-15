import type { ModuleManifest } from '@accounting/shared'

export const manifest: ModuleManifest = {
  id: 'accounts-payable',
  name: 'Accounts Payable',
  description: 'Track vendor bills, payments, and outstanding balances.',
  version: '1.0.0',
  icon: 'ArrowDownCircle',
  alwaysOn: false,
  dependsOn: ['general-ledger'],
  navItems: [{ label: 'Accounts Payable', path: '/accounts-payable', icon: 'ArrowDownCircle' }],
  permissions: {
    owner: ['read', 'write', 'delete'],
    admin: ['read', 'write'],
    member: ['read'],
  },
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  pages: async () => ({ index: (await import('./pages/index.js')).default }),
}
