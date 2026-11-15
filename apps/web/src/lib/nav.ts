export type NavLink = { label: string; path: string; permission?: string }
export type NavGroup = { title: string; moduleId?: string; links: NavLink[] }

// Sidebar menu. Mirrors the legacy CONTAC menu order where it applies.
// `permission` is the fine permission that opens the screen.
export const NAV: NavGroup[] = [
  {
    title: 'Contabilidad',
    moduleId: 'general-ledger',
    links: [
      { label: 'Elaboración de partidas', path: '/contabilidad/partidas', permission: 'gl.entry.view' },
      { label: 'Catálogo de cuentas', path: '/contabilidad/catalogo', permission: 'coa.account.view' },
      { label: 'Tipos de partida', path: '/contabilidad/tipos-partida', permission: 'gl.entry_type.view' },
      { label: 'Centros de costo', path: '/contabilidad/centros-costo', permission: 'gl.cost_center.view' },
      { label: 'Cierre de mes', path: '/contabilidad/periodos', permission: 'gl.period.view' },
      { label: 'Cierre anual', path: '/contabilidad/cierre-anual', permission: 'gl.annual_close.run' },
    ],
  },
  {
    title: 'Reportes contables',
    moduleId: 'general-ledger',
    links: [
      { label: 'Balance de comprobación', path: '/contabilidad/reportes/balance-comprobacion', permission: 'gl.report.view' },
      { label: 'Libro mayor', path: '/contabilidad/reportes/mayor', permission: 'gl.report.view' },
      { label: 'Libro diario', path: '/contabilidad/reportes/diario', permission: 'gl.report.view' },
      { label: 'Balance general', path: '/contabilidad/reportes/balance-general', permission: 'gl.report.view' },
      { label: 'Estado de resultados', path: '/contabilidad/reportes/estado-resultados', permission: 'gl.report.view' },
      { label: 'Partidas descuadradas', path: '/contabilidad/reportes/descuadradas', permission: 'gl.report.view' },
      { label: 'Revisión del catálogo', path: '/contabilidad/reportes/revision-catalogo', permission: 'coa.integrity.view' },
    ],
  },
  {
    title: 'Administración',
    links: [
      { label: 'Empresas', path: '/empresas', permission: 'core.empresas.manage' },
      { label: 'Usuarios', path: '/usuarios', permission: 'core.users.manage' },
      { label: 'Configuración', path: '/settings', permission: 'core.settings.manage' },
      { label: 'Bitácora', path: '/bitacora', permission: 'core.audit.view' },
      { label: 'Migración', path: '/migracion', permission: 'core.migration.run' },
    ],
  },
]

// Permission needed to open a path; undefined when the path is not a menu entry.
export function permissionForPath(pathname: string): string | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  for (const g of NAV) for (const l of g.links) if (l.path === path) return l.permission
  return undefined
}
