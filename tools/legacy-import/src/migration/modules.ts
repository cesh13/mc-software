// What the migration screen expects to find in each legacy module folder.
// Tables come from docs/legacy/<module>/data-model.md; `required` = the module's
// own importer cannot run without it. `probe` = movement table whose dates give
// the module's data range.

export type ModuleSpec = {
  id: string
  label: string
  // Folder names under the root, case-insensitive. BANCOC data lives in CONTAC.
  folders: string[]
  // Sub-folder that holds the data, case-insensitive ('dbf', 'DBF').
  dataDirs: string[]
  tables: { name: string; required?: boolean }[]
  probe?: { table: string; field?: string; salfec?: boolean }
  importer: string | null
}

export const MODULES: ModuleSpec[] = [
  {
    id: 'CONTAC', label: 'Contabilidad', folders: ['CONTAC'], dataDirs: ['dbf', ''],
    tables: [
      { name: 'CATALOGO', required: true }, { name: 'PARTIDAS', required: true }, { name: 'DETAPART', required: true },
      { name: 'TIPOPAR' }, { name: 'CCOSTO' }, { name: 'AGRUPA' }, { name: 'PERIODO' }, { name: 'PRESUP' },
      { name: 'SALDOS' }, { name: 'SALDOCC' },
    ],
    probe: { table: 'PARTIDAS', field: 'salfec', salfec: true },
    importer: 'contac',
  },
  {
    id: 'BANCOC', label: 'Bancos y Cuentas por pagar', folders: ['CONTAC'], dataDirs: ['dbf', ''],
    tables: [
      { name: 'MOVIBAN', required: true }, { name: 'DETABANK', required: true }, { name: 'CTABANCO', required: true },
      { name: 'BANCOS' }, { name: 'PROVEDOR' }, { name: 'QUEDAN' }, { name: 'NCREDEB' }, { name: 'MOVQUE' }, { name: 'PROVISIO' },
    ],
    probe: { table: 'MOVIBAN' },
    importer: null,
  },
  {
    id: 'cxc64', label: 'Cuentas por cobrar', folders: ['cxc64'], dataDirs: ['DBF', ''],
    tables: [{ name: 'CCCLI01', required: true }, { name: 'CCMOV01', required: true }, { name: 'CCTMOV' }],
    probe: { table: 'CCMOV01' },
    importer: null,
  },
  {
    id: 'INV64', label: 'Inventario y facturación', folders: ['INV64'], dataDirs: ['DBF', ''],
    tables: [
      { name: 'ARTICULO', required: true }, { name: 'MOVIMIEN', required: true }, { name: 'DATAMOV' },
      { name: 'CORFACT' }, { name: 'FACT' }, { name: 'FELECTRO' }, { name: 'FANULAR' },
    ],
    probe: { table: 'MOVIMIEN' },
    importer: null,
  },
  {
    id: 'IVA64', label: 'IVA', folders: ['IVA64'], dataDirs: ['dbf', ''],
    tables: [{ name: 'COMPRAS', required: true }, { name: 'IVAFIS' }, { name: 'IVAFAC' }, { name: 'RENTAT' }, { name: 'CONTRIBU' }, { name: 'CLIENTES' }],
    probe: { table: 'COMPRAS' },
    importer: null,
  },
  {
    id: 'LOTE64', label: 'Producción', folders: ['LOTE64'], dataDirs: ['DBF', ''],
    tables: [{ name: 'LOTE', required: true }, { name: 'DETALOTE', required: true }, { name: 'FORMULA' }, { name: 'DETAFORM' }],
    probe: { table: 'LOTE' },
    importer: null,
  },
  {
    id: 'AFIJO64', label: 'Activo fijo', folders: ['AFIJO64'], dataDirs: ['DBF', ''],
    tables: [{ name: 'ACTIVO', required: true }, { name: 'MOVDEPRE', required: true }],
    probe: { table: 'MOVDEPRE' },
    importer: null,
  },
  {
    id: 'plan64', label: 'Planilla', folders: ['plan64'], dataDirs: ['dbf', ''],
    tables: [{ name: 'MAESTRO', required: true }, { name: 'PLANILLA', required: true }],
    probe: { table: 'PLANILLA' },
    importer: null,
  },
]
