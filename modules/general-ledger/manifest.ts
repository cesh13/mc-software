import type { ModuleManifest } from '@accounting/shared'
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
  consumes: { required: ['periods'] },
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  // Screens live in apps/web (static export cannot load module pages at runtime).
  pages: async () => ({}),
}
