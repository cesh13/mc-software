// Spanish names for the importers' counters; unknown keys are shown as they come.
export const COUNT_LABELS: Record<string, string> = {
  core_empresas: 'Empresas', coa_accounts: 'Cuentas', coa_budget_groups: 'Agrupaciones de presupuesto',
  gl_cost_centers: 'Centros de costo', gl_entry_types: 'Tipos de partida', gl_journal_entries: 'Partidas',
  gl_journal_lines: 'Líneas de partida', gl_fiscal_years: 'Años fiscales', core_periods: 'Meses',
  gl_budgets: 'Presupuestos', empresa_creada: 'Empresa creada (1 = sí)',
  filas_leidas: 'Filas leídas', ya_importadas: 'Filas ya importadas', partiesCreated: 'Terceros creados',
  partiesUpdated: 'Terceros actualizados', customers: 'Clientes', suppliers: 'Proveedores', bothRoles: 'Cliente y proveedor',
  persons: 'Personas naturales', companies: 'Empresas (personas jurídicas)', inactive: 'Inactivos',
  withoutTaxId: 'Sin NRC, NIT ni DUI', codesGeneratedNoLegacyCode: 'Código generado (sin código anterior)',
  codesGeneratedCodeTaken: 'Código generado (código anterior ocupado)', uniones: 'Filas unidas en un tercero',
}
export const countLabel = (key: string) => COUNT_LABELS[key] ?? key
