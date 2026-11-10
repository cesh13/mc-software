import type { Permission } from '@accounting/shared'

export type NavLink = { label: string; path: string; permission?: Permission }
export type NavGroup = { title: string; moduleId?: string; links: NavLink[] }

// Sidebar menu. Mirrors the legacy CONTAC menu order where it applies.
export const NAV: NavGroup[] = [
  {
    title: 'Contabilidad',
    moduleId: 'general-ledger',
    links: [
      { label: 'Elaboración de partidas', path: '/contabilidad/partidas', permission: 'capture' },
      { label: 'Catálogo de cuentas', path: '/contabilidad/catalogo' },
      { label: 'Tipos de partida', path: '/contabilidad/tipos-partida' },
      { label: 'Centros de costo', path: '/contabilidad/centros-costo' },
      { label: 'Cierre de mes', path: '/contabilidad/periodos', permission: 'supervise' },
      { label: 'Cierre anual', path: '/contabilidad/cierre-anual', permission: 'supervise' },
    ],
  },
  {
    title: 'Reportes contables',
    moduleId: 'general-ledger',
    links: [
      { label: 'Balance de comprobación', path: '/contabilidad/reportes/balance-comprobacion', permission: 'reports' },
      { label: 'Libro mayor', path: '/contabilidad/reportes/mayor', permission: 'reports' },
      { label: 'Libro diario', path: '/contabilidad/reportes/diario', permission: 'reports' },
      { label: 'Balance general', path: '/contabilidad/reportes/balance-general', permission: 'reports' },
      { label: 'Estado de resultados', path: '/contabilidad/reportes/estado-resultados', permission: 'reports' },
      { label: 'Partidas descuadradas', path: '/contabilidad/reportes/descuadradas', permission: 'reports' },
      { label: 'Revisión del catálogo', path: '/contabilidad/reportes/revision-catalogo', permission: 'reports' },
    ],
  },
  {
    title: 'Administración',
    links: [
      { label: 'Empresas', path: '/empresas', permission: 'supervise' },
      { label: 'Configuración', path: '/settings', permission: 'supervise' },
    ],
  },
]
