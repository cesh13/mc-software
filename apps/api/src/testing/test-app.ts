import Database from 'better-sqlite3-multiple-ciphers'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { Hono } from 'hono'
import path from 'path'
import { fileURLToPath } from 'url'
import { nowIso, type CurrentUser, type Db } from '@accounting/shared/server'
import * as schema from '../db/schema.js'
import { registerCoreServices } from '../core/index.js'
import { loadModules } from '../lib/module-loader.js'
import { EMPRESA_HEADER, handleError, type PlatformDeps } from '../middleware/module-context.js'
import { createEmpresasRoute } from '../routes/empresas.js'
import { createEmpresaProfileRoute } from '../routes/empresa-profile.js'
import { createAuditRoute } from '../routes/audit.js'
import { createMigrationRoute } from '../routes/migration.js'
import { createPermissionsRoute } from '../routes/permissions.js'
import { createEmpresaSettingsRoute } from '../routes/empresa-settings.js'
import { createEmpresaModulesRoute } from '../routes/empresa-modules.js'
import type { ModuleManifest } from '@accounting/shared'
import { createUsersRoute, type CreateAccount } from '../routes/users.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..', '..', '..')

export type TestRequest = {
  method?: string
  body?: unknown
  // Role of the caller. Default 'owner'.
  role?: string
  userId?: string
  // Active empresa. Default: the seeded one. Pass null to send no header.
  empresaId?: string | null
}

// Raw handle for assertions and fixtures written in SQL.
export type TestSqlite = {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
    run(...params: unknown[]): unknown
  }
  exec(sql: string): unknown
}

// In-memory platform for tests: real migrations, real module routers, no
// encryption and no Better Auth (the caller is taken from test headers).
export async function createTestApp(opts: {
  modules: string[]
  createAccount?: CreateAccount
  // Extra in-memory modules (e.g. fake providers/consumers); installed globally.
  extraManifests?: ModuleManifest[]
}) {
  const raw = new Database(':memory:')
  raw.pragma('foreign_keys=ON')
  const sqlite: TestSqlite = raw
  const db = drizzle(raw, { schema }) as unknown as Db
  migrate(db, { migrationsFolder: path.join(here, '..', 'db', 'migrations') })

  const empresaId = 'empresa-test'
  const now = nowIso()
  db.insert(schema.coreEmpresas)
    .values({ id: empresaId, name: 'Empresa de Prueba', siglas: 'TST', createdAt: now, updatedAt: now })
    .run()

  const deps: PlatformDeps = {
    db: () => db,
    resolveUser: async (headers) => {
      const role = headers.get('x-test-role')
      if (!role) return null
      const id = headers.get('x-test-user') ?? 'user-test'
      return { id, name: 'Usuario de Prueba', email: `${id}@test.local`, role } satisfies CurrentUser
    },
  }

  const app = new Hono()
  app.onError(handleError)
  app.route('/api/empresas', createEmpresasRoute(deps))
  app.route('/api/empresa-profile', createEmpresaProfileRoute(deps))
  app.route('/api/audit', createAuditRoute(deps))
  app.route('/api/users', createUsersRoute(deps, { createAccount: opts.createAccount }))
  app.route('/api/permissions', createPermissionsRoute(deps))
  app.route('/api/migration', createMigrationRoute(deps))
  app.route('/api/empresa-settings', createEmpresaSettingsRoute(deps))
  for (const m of opts.extraManifests ?? []) {
    raw.prepare("insert into modules (id, name, version, is_enabled, is_always_on, installed_at) values (?, ?, ?, 1, ?, 'x')")
      .run(m.id, m.name, m.version, m.alwaysOn ? 1 : 0)
  }
  const { loaded, catalog, directory } = await loadModules(app, deps, {
    modulesDir: path.join(repoRoot, 'modules'),
    only: [...opts.modules, ...(opts.extraManifests ?? []).map((m) => m.id)],
    extraManifests: opts.extraManifests,
    registerCore: registerCoreServices,
  })
  app.route('/api/empresa-modules', createEmpresaModulesRoute(deps, catalog))

  async function request(url: string, req: TestRequest = {}) {
    const headers: Record<string, string> = {
      'x-test-role': req.role ?? 'owner',
      'x-test-user': req.userId ?? 'user-test',
    }
    const empresa = req.empresaId === undefined ? empresaId : req.empresaId
    if (empresa) headers[EMPRESA_HEADER] = empresa
    if (req.body !== undefined) headers['content-type'] = 'application/json'
    const res = await app.request(url, {
      method: req.method ?? (req.body === undefined ? 'GET' : 'POST'),
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
    })
    const text = await res.text()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = text
    }
    return { status: res.status, json }
  }

  return { app, db, sqlite, empresaId, loaded, catalog, directory, request }
}
