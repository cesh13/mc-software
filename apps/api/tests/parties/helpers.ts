import { createTestApp } from '../../src/testing/test-app.js'

export type App = Awaited<ReturnType<typeof createTestApp>>
export type Opts = { role?: string; userId?: string; empresaId?: string | null }

export const BASE = '/api/parties/parties'

export const app = () => createTestApp({ modules: ['parties'] })

export function post(t: App, path: string, body: unknown, o: Opts = {}) {
  return t.request(BASE + path, { body, ...o })
}
export function patch(t: App, path: string, body: unknown, o: Opts = {}) {
  return t.request(BASE + path, { method: 'PATCH', body, ...o })
}
export function act(t: App, path: string, o: Opts = {}) {
  return t.request(BASE + path, { method: 'POST', ...o })
}
export function get(t: App, path: string, o: Opts = {}) {
  return t.request(BASE + path, o)
}

// Creates a party and fails the test if the API rejects it.
export async function mk(t: App, code: string, over: Record<string, unknown> = {}, o: Opts = {}) {
  const res = await post(t, '', { code, name: `Tercero ${code}`, isCustomer: true, ...over }, o)
  if (res.status !== 201) throw new Error(`mk(${code}) -> ${res.status} ${JSON.stringify(res.json)}`)
  return res.json as { id: string; code: string; nrc: string | null; nit: string | null }
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
