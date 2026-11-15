// Shared period state per empresa, month and area (docs/sistema/contratos.md §2). Browser-safe.
export const PERIOD_AREAS = [
  'gl', 'banking', 'ap', 'ar', 'inventory', 'sales', 'tax', 'production', 'fixed_assets', 'payroll',
] as const
export type PeriodArea = (typeof PERIOD_AREAS)[number]

export const PERIOD_STATUSES = ['open', 'closed', 'filed'] as const
export type PeriodStatus = (typeof PERIOD_STATUSES)[number]

export const PERIOD_AREA_LABELS: Record<PeriodArea, string> = {
  gl: 'Contabilidad', banking: 'Bancos', ap: 'Cuentas por pagar', ar: 'Cuentas por cobrar',
  inventory: 'Inventario', sales: 'Ventas', tax: 'IVA', production: 'Producción',
  fixed_assets: 'Activo fijo', payroll: 'Planilla',
}

export type PeriodStateRow = {
  area: PeriodArea
  period: string
  status: PeriodStatus
  closedBy: string | null
  closedAt: string | null
  reopenedBy: string | null
  reopenedAt: string | null
  reopenReason: string | null
}

// Minimum length of the reason required to reopen a period.
export const REOPEN_REASON_MIN = 10
