import type { EntryInput } from '@accounting/shared'
import { createTestApp } from '../../src/testing/test-app.js'

export type App = Awaited<ReturnType<typeof createTestApp>>
export type Opts = { role?: string; userId?: string; empresaId?: string | null }

export const GL = '/api/general-ledger'

export async function newApp() {
  return createTestApp({ modules: ['chart-of-accounts', 'general-ledger'] })
}

export function get(t: App, path: string, o: Opts = {}) {
  return t.request(GL + path, o)
}
export function post(t: App, path: string, body: unknown = {}, o: Opts = {}) {
  return t.request(GL + path, { method: 'POST', body, ...o })
}
export function put(t: App, path: string, body: unknown, o: Opts = {}) {
  return t.request(GL + path, { method: 'PUT', body, ...o })
}
export function patch(t: App, path: string, body: unknown, o: Opts = {}) {
  return t.request(GL + path, { method: 'PATCH', body, ...o })
}

const now = () => new Date().toISOString()

export function addEmpresa(t: App, id: string, siglas: string) {
  t.sqlite
    .prepare('insert into core_empresas (id, name, siglas, created_at, updated_at) values (?, ?, ?, ?, ?)')
    .run(id, `Empresa ${siglas}`, siglas, now(), now())
}

// Non-owner roles need a user row and an empresa grant.
export function addUser(t: App, id: string, empresaIds: string[] = [t.empresaId]) {
  t.sqlite
    .prepare('insert into user (id, name, email, created_at, updated_at) values (?, ?, ?, ?, ?)')
    .run(id, id, `${id}@test.local`, now(), now())
  for (const e of empresaIds) {
    t.sqlite
      .prepare('insert into core_user_empresas (user_id, empresa_id, created_at) values (?, ?, ?)')
      .run(id, e, now())
  }
}

export type AccountSpec = {
  code: string
  type?: string
  parent?: string // parent code
  detail?: boolean
  cc?: boolean
  active?: boolean
  empresaId?: string
}

// Raw account insert (the chart-of-accounts API is not used here). Id = `acc-<empresa>-<code>`.
export function account(t: App, a: AccountSpec): string {
  const empresa = a.empresaId ?? t.empresaId
  const id = `acc-${empresa}-${a.code}`
  let level = 1
  let parentId: string | null = null
  if (a.parent) {
    parentId = `acc-${empresa}-${a.parent}`
    const p = t.sqlite.prepare('select level from coa_accounts where id = ?').get(parentId) as { level: number }
    level = p.level + 1
  }
  t.sqlite
    .prepare(
      `insert into coa_accounts (id, empresa_id, code, name, type, parent_id, level, is_detail,
         requires_cost_center, is_active, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, empresa, a.code, `Cuenta ${a.code}`, a.type ?? 'activo', parentId, level,
      a.detail === false ? 0 : 1, a.cc ? 1 : 0, a.active === false ? 0 : 1, now(), now())
  return id
}

export function accId(t: App, code: string, empresaId = t.empresaId) {
  return `acc-${empresaId}-${code}`
}

export async function entryType(t: App, code = 'PD', numberWidth = 6, o: Opts = {}): Promise<string> {
  const res = await post(t, '/entry-types', { code, name: `Tipo ${code}`, numberWidth }, o)
  if (res.status !== 201) throw new Error(`entryType -> ${res.status} ${JSON.stringify(res.json)}`)
  return res.json.id
}

export async function costCenter(t: App, code: string): Promise<string> {
  const res = await post(t, '/cost-centers', { code, name: `Centro ${code}` })
  if (res.status !== 201) throw new Error(`costCenter -> ${res.status} ${JSON.stringify(res.json)}`)
  return res.json.id
}

type Line = { a: string; d?: string; c?: string; cc?: string; detail?: string }

export function entryBody(typeId: string, period: string, lines: Line[], over: Partial<EntryInput> = {}) {
  return {
    period,
    entryTypeId: typeId,
    date: `${period}-15`,
    concept: 'Partida de prueba',
    lines: lines.map((l) => ({
      accountId: l.a,
      debit: l.d ?? '0.00',
      credit: l.c ?? '0.00',
      costCenterId: l.cc,
      detail: l.detail ?? '',
    })),
    ...over,
  }
}

// Creates an entry and fails the test if the API rejects it.
export async function entry(t: App, typeId: string, period: string, lines: Line[], over: Partial<EntryInput> = {}) {
  const res = await post(t, '/entries', entryBody(typeId, period, lines, over))
  if (res.status !== 201) throw new Error(`entry -> ${res.status} ${JSON.stringify(res.json)}`)
  return res.json as { id: string; number: string; status: string; numberReassigned: boolean }
}

export function auditActions(t: App, entityId: string): string[] {
  return (
    t.sqlite
      .prepare("select action from core_audit_log where entity_id = ? and module = 'general-ledger' order by rowid")
      .all(entityId) as { action: string }[]
  ).map((r) => r.action)
}

// Standard chart used by most tests: a 3-level hierarchy for every type.
export function standardChart(t: App, empresaId = t.empresaId) {
  const e = { empresaId }
  const types = ['activo', 'pasivo', 'capital', 'gastos', 'ingresos', 'orden', 'contra']
  types.forEach((type, i) => {
    const root = String(i + 1)
    account(t, { code: root, type, detail: false, ...e })
    account(t, { code: `${root}1`, type, parent: root, detail: false, ...e })
    account(t, { code: `${root}101`, type, parent: `${root}1`, ...e })
    account(t, { code: `${root}102`, type, parent: `${root}1`, ...e })
  })
}
