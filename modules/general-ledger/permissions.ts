import type { PermissionDef } from '@accounting/shared'

// Fine permissions of this module (docs/sistema/fase-0.md §2).
const P = (id: string, label: string, group: string, packages: PermissionDef['packages']): PermissionDef =>
  ({ id, label, group, packages })

export const GL_PERMISSIONS: PermissionDef[] = [
  P('gl.entry.view', 'Consultar partidas', 'Elaboración de partidas', ['capture', 'reports']),
  P('gl.entry.create', 'Agregar y copiar partidas', 'Elaboración de partidas', ['capture']),
  P('gl.entry.update', 'Modificar partidas', 'Elaboración de partidas', ['capture']),
  P('gl.entry.apply', 'Aplicar un borrador', 'Elaboración de partidas', ['capture']),
  P('gl.entry.unapply', 'Regresar a borrador una partida aplicada', 'Elaboración de partidas', ['supervise']),
  P('gl.entry.void', 'Anular partidas', 'Elaboración de partidas', ['capture']),
  P('gl.entry_type.view', 'Consultar tipos de partida', 'Tipos de partida', ['capture', 'reports']),
  P('gl.entry_type.manage', 'Agregar, modificar y desactivar tipos de partida', 'Tipos de partida', ['capture']),
  P('gl.cost_center.view', 'Consultar centros de costo', 'Centros de costo', ['capture', 'reports']),
  P('gl.cost_center.manage', 'Agregar, modificar y desactivar centros de costo', 'Centros de costo', ['capture']),
  P('gl.fiscal_year.view', 'Consultar años fiscales', 'Años fiscales', ['capture', 'reports']),
  P('gl.fiscal_year.manage', 'Crear años fiscales', 'Años fiscales', ['supervise']),
  P('gl.period.view', 'Consultar el estado de los meses', 'Cierre de mes', ['capture', 'reports']),
  P('gl.period.close', 'Cerrar mes', 'Cierre de mes', ['supervise']),
  P('gl.period.reopen', 'Abrir mes cerrado', 'Cierre de mes', ['supervise']),
  P('gl.annual_close.run', 'Cierre anual', 'Cierre anual', ['supervise']),
  P('gl.report.view', 'Reportes contables', 'Reportes', ['reports']),
  P('gl.report.export', 'Imprimir y exportar reportes', 'Reportes', ['reports']),
]
