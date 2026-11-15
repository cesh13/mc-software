import type { PermissionDef } from '@accounting/shared'

// Fine permissions of this module (docs/sistema/fase-0.md §2).
export const COA_PERMISSIONS: PermissionDef[] = [
  { id: 'coa.account.view', label: 'Consultar el catálogo de cuentas', group: 'Catálogo de cuentas', packages: ['capture', 'reports'] },
  { id: 'coa.account.create', label: 'Agregar cuentas', group: 'Catálogo de cuentas', packages: ['capture'] },
  { id: 'coa.account.update', label: 'Modificar cuentas', group: 'Catálogo de cuentas', packages: ['capture'] },
  { id: 'coa.account.deactivate', label: 'Desactivar y reactivar cuentas', group: 'Catálogo de cuentas', packages: ['supervise'] },
  { id: 'coa.budget_group.view', label: 'Consultar agrupaciones de presupuesto', group: 'Agrupaciones de presupuesto', packages: ['capture', 'reports'] },
  { id: 'coa.budget_group.manage', label: 'Agregar y modificar agrupaciones', group: 'Agrupaciones de presupuesto', packages: ['capture'] },
  { id: 'coa.budget_group.deactivate', label: 'Desactivar y reactivar agrupaciones', group: 'Agrupaciones de presupuesto', packages: ['supervise'] },
  { id: 'coa.integrity.view', label: 'Revisión del catálogo', group: 'Catálogo de cuentas', packages: ['reports'] },
]
