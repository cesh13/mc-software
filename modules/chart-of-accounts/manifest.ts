import type { ModuleManifest } from '@accounting/shared'
import { COA_PERMISSIONS } from './permissions.js'

export const manifest: ModuleManifest = {
  id: 'chart-of-accounts',
  name: 'Chart of Accounts',
  description: 'Manage the master list of accounts used across all financial records.',
  version: '1.0.0',
  icon: 'BookOpen',
  alwaysOn: true,
  dependsOn: [],
  navItems: [{ label: 'Chart of Accounts', path: '/chart-of-accounts', icon: 'BookOpen' }],
  permissions: COA_PERMISSIONS,
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  // Screens live in apps/web (static export cannot load module pages at runtime).
  pages: async () => ({}),
}
