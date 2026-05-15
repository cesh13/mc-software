import type { ModuleManifest } from '@accounting/shared'

export const manifest: ModuleManifest = {
  id: 'accounts-receivable',
  name: 'Accounts Receivable',
  description: 'Track customer invoices, payments received, and outstanding balances.',
  version: '1.0.0',
  icon: 'ArrowUpCircle',
  alwaysOn: false,
  dependsOn: ['general-ledger'],
  navItems: [{ label: 'Accounts Receivable', path: '/accounts-receivable', icon: 'ArrowUpCircle' }],
  permissions: {
    owner: ['read', 'write', 'delete'],
    admin: ['read', 'write'],
    member: ['read'],
  },
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  pages: async () => ({ index: (await import('./pages/index.js')).default }),
}
