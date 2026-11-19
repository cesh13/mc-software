import { balanceSignatures, type ModuleManifest } from '@accounting/shared'
import type { ServiceFactory } from '@accounting/shared/server'
import { GL_PERMISSIONS } from './permissions.js'

export const manifest: ModuleManifest = {
  id: 'general-ledger',
  name: 'General Ledger',
  description: 'Journal entries, fiscal periods, and the trial balance.',
  version: '1.0.0',
  icon: 'BookMarked',
  alwaysOn: true,
  dependsOn: ['chart-of-accounts'],
  navItems: [{ label: 'General Ledger', path: '/general-ledger', icon: 'BookMarked' }],
  permissions: GL_PERMISSIONS,
  settings: [
    {
      namespace: 'gl', key: 'balanceSignatures',
      label: 'Firmas y cargos al pie del Balance General',
      schema: balanceSignatures, default: [],
    },
  ],
  consumes: { required: ['periods'] },
  // contratos.md §1: the only way other modules post, replace or void entries.
  provides: {
    ledger: async () => (await import('./services/ledger-provider.js')).ledgerProvider as ServiceFactory,
  },
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  // Screens live in apps/web (static export cannot load module pages at runtime).
  pages: async () => ({}),
}
