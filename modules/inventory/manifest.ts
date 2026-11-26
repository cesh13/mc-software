import { z } from 'zod'
import type { ModuleManifest } from '@accounting/shared'
import { INV_PERMISSIONS } from './permissions.js'

export const manifest: ModuleManifest = {
  id: 'inventory',
  name: 'Inventario',
  description: 'Productos, bodegas, movimientos, kárdex y costo promedio.',
  version: '1.0.0',
  icon: 'Package',
  alwaysOn: false,
  dependsOn: ['chart-of-accounts', 'general-ledger', 'parties'],
  navItems: [{ label: 'Inventario', path: '/inventario/movimientos', icon: 'Package' }],
  permissions: INV_PERMISSIONS,
  settings: [
    {
      namespace: 'inventory', key: 'entryTypeId',
      label: 'Tipo de partida para los movimientos de inventario',
      schema: z.string().nullable(), default: null,
    },
    {
      namespace: 'inventory', key: 'postToGl',
      label: 'Contabilizar los movimientos de inventario',
      schema: z.boolean(), default: true,
    },
    {
      namespace: 'inventory', key: 'negativeStock',
      label: 'Salidas sin existencia suficiente',
      schema: z.enum(['bloquear', 'permitir']), default: 'bloquear',
    },
  ],
  consumes: { required: ['periods', 'sequences', 'settings', 'ledger'], optional: ['parties'] },
  schema: async () => (await import('./schema.js')).default,
  router: async () => (await import('./routes.js')).default,
  // Screens live in apps/web (static export cannot load module pages at runtime).
  pages: async () => ({}),
}
