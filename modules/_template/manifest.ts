import type { ModuleManifest } from '@accounting/shared'

export const manifest: ModuleManifest = {
  id: 'template',
  name: 'Template Module',
  description: 'Copy this folder to create a new module. Rename the folder and update this manifest.',
  version: '1.0.0',
  icon: 'Package',
  alwaysOn: false,
  dependsOn: [],
  navItems: [{ label: 'Template', path: '/template', icon: 'Package' }],
  permissions: {
    owner: ['read', 'write', 'delete'],
    admin: ['read', 'write'],
    member: ['read'],
  },
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  pages: async () => ({ index: (await import('./pages/index.js')).default }),
}
