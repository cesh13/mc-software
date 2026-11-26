import type { PermissionDef } from '@accounting/shared'

// Fine permissions of this module (docs/sistema/fase-0.md F1).
const ITEMS = 'Inventario: productos'
const CONFIG = 'Inventario: bodegas, grupos y tipos'
const DOCS = 'Inventario: movimientos'
const REPORTS = 'Inventario: reportes'
const PERIODS = 'Inventario: cierre de mes'

export const INV_PERMISSIONS: PermissionDef[] = [
  { id: 'inv.item.view', label: 'Consultar productos', group: ITEMS, packages: ['capture', 'reports'] },
  { id: 'inv.item.manage', label: 'Agregar y modificar productos', group: ITEMS, packages: ['capture'] },
  { id: 'inv.item.deactivate', label: 'Desactivar y reactivar productos', group: ITEMS, packages: ['supervise'] },
  { id: 'inv.config.view', label: 'Consultar bodegas, grupos y tipos de movimiento', group: CONFIG, packages: ['capture', 'reports'] },
  { id: 'inv.config.manage', label: 'Mantener bodegas, grupos y tipos de movimiento', group: CONFIG, packages: ['supervise'] },
  { id: 'inv.document.view', label: 'Consultar movimientos', group: DOCS, packages: ['capture', 'reports'] },
  { id: 'inv.document.create', label: 'Grabar movimientos', group: DOCS, packages: ['capture'] },
  { id: 'inv.document.void', label: 'Anular movimientos', group: DOCS, packages: ['supervise'] },
  { id: 'inv.stock.negative', label: 'Grabar salidas sin existencia suficiente', group: DOCS, packages: ['supervise'] },
  { id: 'inv.import.run', label: 'Importar productos e inventario inicial', group: DOCS, packages: ['supervise'] },
  { id: 'inv.report.view', label: 'Ver reportes de existencias y kárdex', group: REPORTS, packages: ['reports'] },
  // Sensitive (modulos-y-orden §2.6): no package grants it; owner or explicit grant.
  { id: 'inv.cost.view', label: 'Ver costos y valorización', group: REPORTS, packages: [] },
  { id: 'inv.period.view', label: 'Consultar meses cerrados', group: PERIODS, packages: ['capture', 'reports'] },
  { id: 'inv.period.close', label: 'Cerrar mes de inventario', group: PERIODS, packages: ['supervise'] },
  { id: 'inv.period.reopen', label: 'Reabrir mes de inventario', group: PERIODS, packages: ['supervise'] },
]
