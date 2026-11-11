import Database from 'better-sqlite3-multiple-ciphers'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  checkContacParity,
  importContac,
  type ImportReport,
  type ParityReport,
  type ParityTable,
  type SqlHandle,
} from '@accounting/legacy-import'
import type { Db } from '@accounting/shared/server'
import { migrateModule } from '../lib/module-loader.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const MODULES = ['chart-of-accounts', 'general-ledger']

const USAGE = `Uso: pnpm --filter @accounting/api legacy:import -- --source <carpeta MCERP/CONTAC>
       [--db <archivo sqlite sin cifrar>] [--replace] [--parity] [--report <ruta json>]
       [--user <id>] [--siglas <siglas de la empresa>]
Sin --db se usa la base de datos cifrada de la plataforma.`

function runMigrations(db: Db): void {
  migrate(db as never, { migrationsFolder: path.join(here, '..', 'db', 'migrations') })
  const modulesDir = process.env.ACCOUNTING_MODULES_DIR ?? path.join(here, '..', '..', '..', '..', 'modules')
  for (const id of MODULES) migrateModule(db, modulesDir, id)
}

async function openTarget(dbFile: string | undefined): Promise<SqlHandle> {
  if (dbFile) {
    mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true })
    const raw = new Database(dbFile)
    raw.pragma('foreign_keys=ON')
    runMigrations(drizzle(raw) as unknown as Db)
    return raw as unknown as SqlHandle
  }
  // Encrypted platform database (key from the OS keychain).
  const { openDatabase } = await import('../db/client.js')
  const db = await openDatabase()
  runMigrations(db as unknown as Db)
  return (db as unknown as { $client: SqlHandle }).$client
}

function printParity(t: ParityTable | null): void {
  if (!t) return console.log('  (tabla no encontrada)')
  console.log(
    `  ${t.table}: ${t.rowsCompared} filas, ${t.monthsCompared} meses, ${t.accountsCompared} cuentas; ` +
      `${t.fieldMismatches} diferencias en ${t.rowsWithMismatch} filas; ${t.missingInLegacy.count} movimientos sin fila en el legado.`,
  )
  if (t.fieldMismatches) console.log(`    causas (filas): ${JSON.stringify(t.byCause)}  campos: ${JSON.stringify(t.byField)}`)
  for (const m of t.first.slice(0, 5)) {
    console.log(`    ${m.period} ${m.account}${m.costCenter !== undefined ? ` cc=${m.costCenter}` : ''} ${m.field}: legado ${m.legacy} / nuevo ${m.computed} [${m.cause}]`)
  }
}

function printSummary(r: ImportReport, parity: ParityReport | null): void {
  console.log(`\nImportación de CONTAC a la empresa ${r.empresa.siglas}${r.empresa.replaced ? ' (reemplazó la importación anterior)' : ''}`)
  for (const [table, n] of Object.entries(r.counts)) console.log(`  ${table}: ${n}`)
  for (const [name, s] of Object.entries(r.source)) {
    console.log(`  fuente ${name}: ${s.live} vigentes, ${s.deleted} borrados omitidos, ${s.encoding} (${s.encodingReason === 'marked' ? 'marcada' : 'detectada'})`)
  }
  console.log(`  partidas descuadradas: ${r.unbalancedEntries.length}; encabezados creados: ${r.orphanHeaders.length}`)
  console.log(`  cuentas provisionales: ${r.placeholders.accounts.length}; hallazgos del catálogo: ${r.catalogFindings.length}`)
  for (const [cat, w] of Object.entries(r.warnings)) console.log(`  aviso ${cat}: ${w.count}`)
  if (parity) {
    console.log(`\nParidad con los saldos del sistema anterior: ${parity.ok ? 'SIN DIFERENCIAS' : 'HAY DIFERENCIAS'}`)
    printParity(parity.saldos)
    printParity(parity.saldocc)
  }
}

export async function main(argv: string[]): Promise<number> {
  const args = argv.filter((a, i) => !(a === '--' && i === argv.indexOf('--')))
  const { values } = parseArgs({
    args,
    options: {
      source: { type: 'string' }, db: { type: 'string' }, report: { type: 'string' },
      user: { type: 'string' }, siglas: { type: 'string' },
      replace: { type: 'boolean', default: false }, parity: { type: 'boolean', default: false },
    },
  })
  if (!values.source) {
    console.error(USAGE)
    return 2
  }
  const handle = await openTarget(values.db)
  const report = importContac(handle, {
    sourceDir: path.resolve(values.source), replace: values.replace, userId: values.user, siglas: values.siglas,
  })
  const parity = values.parity ? checkContacParity(handle, path.resolve(values.source), report.empresa.id) : null
  printSummary(report, parity)
  if (values.report) {
    mkdirSync(path.dirname(path.resolve(values.report)), { recursive: true })
    writeFileSync(values.report, JSON.stringify({ import: report, parity }, null, 2))
    console.log(`\nInforme completo: ${values.report}`)
  }
  return 0
}

// Run only when executed directly (the tests import `main`'s siblings, not this).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    },
  )
}
