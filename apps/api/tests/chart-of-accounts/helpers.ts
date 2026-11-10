import { createTestApp } from '../../src/testing/test-app.js'

export type App = Awaited<ReturnType<typeof createTestApp>>
export type Opts = { role?: string; userId?: string; empresaId?: string | null }

export const BASE = '/api/chart-of-accounts'

export function post(t: App, path: string, body: unknown, o: Opts = {}) {
  return t.request(BASE + path, { body, ...o })
}
export function patch(t: App, path: string, body: unknown, o: Opts = {}) {
  return t.request(BASE + path, { method: 'PATCH', body, ...o })
}
// POST without a body (deactivate / reactivate).
export function act(t: App, path: string, o: Opts = {}) {
  return t.request(BASE + path, { method: 'POST', ...o })
}
export function get(t: App, path: string, o: Opts = {}) {
  return t.request(BASE + path, o)
}

// Creates an account and fails the test if the API rejects it.
export async function mk(t: App, code: string, over: Record<string, unknown> = {}) {
  const res = await post(t, '/accounts', { code, name: `Cuenta ${code}`, type: 'activo', ...over })
  if (res.status !== 201) throw new Error(`mk(${code}) -> ${res.status} ${JSON.stringify(res.json)}`)
  return res.json as { id: string; code: string; level: number; type: string }
}

export function addEmpresa(t: App, id: string, siglas: string) {
  const now = new Date().toISOString()
  t.sqlite
    .prepare('insert into core_empresas (id, name, siglas, created_at, updated_at) values (?, ?, ?, ?, ?)')
    .run(id, `Empresa ${siglas}`, siglas, now, now)
}

// Non-owner roles need a user row and an empresa grant.
export function addUser(t: App, id: string, empresaIds: string[] = [t.empresaId]) {
  const now = new Date().toISOString()
  t.sqlite
    .prepare('insert into user (id, name, email, created_at, updated_at) values (?, ?, ?, ?, ?)')
    .run(id, id, `${id}@test.local`, now, now)
  for (const e of empresaIds) {
    t.sqlite
      .prepare('insert into core_user_empresas (user_id, empresa_id, created_at) values (?, ?, ?)')
      .run(id, e, now)
  }
}

// Raw insert of a journal line (general-ledger must be loaded).
export function addMovement(t: App, accountId: string, o: { active?: boolean; key?: string } = {}) {
  const key = o.key ?? accountId
  const now = new Date().toISOString()
  t.sqlite
    .prepare(
      'insert into gl_entry_types (id, empresa_id, code, name, created_at, updated_at) values (?, ?, ?, ?, ?, ?)',
    )
    .run(`et-${key}`, t.empresaId, `T${key.slice(0, 6)}`, 'Tipo', now, now)
  t.sqlite
    .prepare(
      `insert into gl_journal_entries (id, empresa_id, period, entry_type_id, number, date, is_active, created_by, created_at, updated_at)
       values (?, ?, '2026-01', ?, '000001', '2026-01-15', ?, 'u', ?, ?)`,
    )
    .run(`je-${key}`, t.empresaId, `et-${key}`, o.active === false ? 0 : 1, now, now)
  t.sqlite
    .prepare(
      `insert into gl_journal_lines (id, entry_id, line_no, account_id, debit, credit) values (?, ?, 1, ?, '10.00', '0.00')`,
    )
    .run(`jl-${key}`, `je-${key}`, accountId)
}

export function auditRows(t: App, entityId: string) {
  return t.sqlite
    .prepare(
      'select module, action, entity, user_id, empresa_id from core_audit_log where entity_id = ? order by at',
    )
    .all(entityId) as { module: string; action: string; entity: string; user_id: string; empresa_id: string }[]
}

// Raw account insert, bypassing every rule (dirty imported data).
export function rawAccount(
  t: App,
  a: {
    id: string
    code: string
    type?: string
    parentId?: string | null
    level?: number
    isDetail?: boolean
    isActive?: boolean
    empresaId?: string
  },
) {
  const now = new Date().toISOString()
  t.sqlite
    .prepare(
      `insert into coa_accounts (id, empresa_id, code, name, type, parent_id, level, is_detail, is_active, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      a.id,
      a.empresaId ?? t.empresaId,
      a.code,
      `Cuenta ${a.code}`,
      a.type ?? 'activo',
      a.parentId ?? null,
      a.level ?? 1,
      a.isDetail ? 1 : 0,
      a.isActive === false ? 0 : 1,
      now,
      now,
    )
}
