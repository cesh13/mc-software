import type { PermissionDef } from '@accounting/shared'

// Fine permissions of this module (docs/sistema/fase-0.md F1).
const GROUP = 'Clientes y proveedores'

export const PTY_PERMISSIONS: PermissionDef[] = [
  { id: 'pty.party.view', label: 'Consultar clientes y proveedores', group: GROUP, packages: ['capture', 'reports'] },
  { id: 'pty.party.create', label: 'Agregar clientes y proveedores', group: GROUP, packages: ['capture'] },
  { id: 'pty.party.update', label: 'Modificar clientes y proveedores', group: GROUP, packages: ['capture'] },
  { id: 'pty.party.deactivate', label: 'Desactivar y reactivar clientes y proveedores', group: GROUP, packages: ['supervise'] },
]
