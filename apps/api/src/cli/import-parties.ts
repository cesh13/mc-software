import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { importParties, type PartiesImportReport } from '@accounting/legacy-import'
import { openTarget } from './target.js'

const USAGE = `Uso: pnpm --filter @accounting/api legacy:import-parties -- --source <carpeta MCERP>
       [--db <archivo sqlite sin cifrar>] [--siglas <siglas de la empresa>] [--replace]
       [--report <ruta json>] [--user <id>]
Lee CCCLI01 (cxc64), PROVEDOR (CONTAC e INV64), CONTRIBU y CLIENTES (IVA64 e INV64).
Sin --db se usa la base de datos cifrada de la plataforma. Detenga la API antes de importar.`

// Counts only: the full report (keys of every merge and conflict) goes to --report.
function printSummary(r: PartiesImportReport): void {
  console.log(`\nImportación de clientes y proveedores a la empresa ${r.empresa.siglas}`)
  if (r.replaced) console.log(`  reemplazó la importación anterior: ${r.replaced.deleted} terceros borrados, ${r.replaced.detached} capturados desligados`)
  for (const [name, s] of Object.entries(r.source)) {
    console.log(`  fuente ${name}: ${s.live} vigentes, ${s.deleted} borrados omitidos, ${s.encoding}`)
  }
  for (const name of r.missingSources) console.log(`  fuente ${name}: no encontrada`)
  console.log(`  filas leídas: ${r.rowsRead}; ya importadas antes: ${r.rowsAlreadyImported}`)
  const c = r.counts
  console.log(`  terceros creados: ${c.partiesCreated}; existentes actualizados: ${c.partiesUpdated}`)
  console.log(`  clientes: ${c.customers}; proveedores: ${c.suppliers}; ambos: ${c.bothRoles}; inactivos: ${c.inactive}`)
  console.log(`  sin NRC, NIT ni DUI: ${c.withoutTaxId}; personas naturales: ${c.persons}; jurídicas: ${c.companies}`)
  console.log(`  códigos generados: ${c.codesGeneratedNoLegacyCode} solo en libros de IVA/INV, ${c.codesGeneratedCodeTaken} con código ocupado`)
  const m = r.mergesSummary
  console.log(`  uniones: ${m.total} (cliente y proveedor: ${m.bothRoles}; varias filas de la misma tabla: ${m.repeatedInSource}; por NIT: ${m.byNit}; a terceros existentes: ${m.intoExisting})`)
  console.log(`  conflictos: ${JSON.stringify(r.conflictsSummary)}`)
  for (const [cat, w] of Object.entries(r.warnings)) console.log(`  aviso ${cat}: ${w.count}`)
}

export async function main(argv: string[]): Promise<number> {
  const args = argv.filter((a, i) => !(a === '--' && i === argv.indexOf('--')))
  const { values } = parseArgs({
    args,
    options: {
      source: { type: 'string' }, db: { type: 'string' }, report: { type: 'string' },
      user: { type: 'string' }, siglas: { type: 'string' }, replace: { type: 'boolean', default: false },
    },
  })
  if (!values.source) {
    console.error(USAGE)
    return 2
  }
  const handle = await openTarget(values.db, ['parties'])
  const report = importParties(handle, {
    sourceRoot: path.resolve(values.source), replace: values.replace, userId: values.user, siglas: values.siglas,
  })
  printSummary(report)
  if (values.report) {
    mkdirSync(path.dirname(path.resolve(values.report)), { recursive: true })
    writeFileSync(values.report, JSON.stringify(report, null, 2))
    console.log(`\nInforme completo: ${values.report}`)
  }
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    },
  )
}
