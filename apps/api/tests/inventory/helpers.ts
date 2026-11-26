import { createTestApp } from '../../src/testing/test-app.js'
import { account, entryType } from '../general-ledger/fixtures.js'

export type App = Awaited<ReturnType<typeof createTestApp>>
export type Opts = { role?: string; userId?: string; empresaId?: string | null }

export const INV = '/api/inventory'

export const get = (t: App, path: string, o: Opts = {}) => t.request(INV + path, o)
export const post = (t: App, path: string, body: unknown = {}, o: Opts = {}) => t.request(INV + path, { method: 'POST', body, ...o })
export const patch = (t: App, path: string, body: unknown, o: Opts = {}) => t.request(INV + path, { method: 'PATCH', body, ...o })

async function ok(res: Promise<{ status: number; json: any }>, what: string, status = 201) {
  const r = await res
  if (r.status !== status) throw new Error(`${what} -> ${r.status} ${JSON.stringify(r.json)}`)
  return r.json
}

export async function setSetting(t: App, key: string, value: unknown) {
  await ok(t.request('/api/empresa-settings', { method: 'PUT', body: { namespace: 'inventory', key, value } }), `setting ${key}`, 200)
}

// Platform with inventory active for the test empresa, accounts, an entry type,
// two warehouses, a group with accounts and the usual movement types.
export async function setup() {
  const t = await createTestApp({ modules: ['chart-of-accounts', 'general-ledger', 'parties', 'inventory'] })
  await ok(t.request('/api/empresa-modules/empresa-test/inventory', { method: 'PUT', body: { enabled: true } }), 'activate', 200)
  const acc = {
    inventory: account(t, { code: '1104' }),
    cogs: account(t, { code: '5101', type: 'gastos' }),
    suppliers: account(t, { code: '2101', type: 'pasivo' }),
    opening: account(t, { code: '3101', type: 'capital' }),
    shrink: account(t, { code: '5102', type: 'gastos' }),
  }
  const entryTypeId = await entryType(t, 'IN')
  await setSetting(t, 'entryTypeId', entryTypeId)
  const wh = {
    a: (await ok(post(t, '/warehouses', { code: '1', name: 'Bodega central' }), 'warehouse')).id as string,
    b: (await ok(post(t, '/warehouses', { code: '2', name: 'Sala de ventas' }), 'warehouse')).id as string,
  }
  const group = (await ok(post(t, '/groups', {
    code: 'G1', name: 'Mercadería', inventoryAccountId: acc.inventory, cogsAccountId: acc.cogs,
  }), 'group')).id as string
  const type = async (code: string, direction: string, kind: string, counterAccountId?: string) =>
    (await ok(post(t, '/movement-types', { code, name: `Tipo ${code}`, direction, kind, counterAccountId }), `type ${code}`)).id as string
  const types = {
    opening: await type('II', 'in', 'inicial', acc.opening),
    purchase: await type('EC', 'in', 'compra', acc.suppliers),
    out: await type('SV', 'out', 'venta'),
    shrink: await type('SA', 'out', 'ajuste', acc.shrink),
    transfer: await type('TR', 'transfer', 'transferencia'),
  }
  return { t, acc, wh, group, types, entryTypeId }
}

export async function item(t: App, code: string, groupId: string, over: Record<string, unknown> = {}) {
  return (await ok(post(t, '/items', { code, name: `Producto ${code}`, groupId, ...over }), `item ${code}`)).id as string
}

export type Line = { itemId: string; quantity: string; unitCost?: string; lotNo?: string; expiresOn?: string }

export function doc(t: App, typeId: string, warehouseId: string, lines: Line[], over: Record<string, unknown> = {}, o: Opts = {}) {
  return post(t, '/documents', { typeId, date: '2026-11-10', warehouseId, lines, ...over }, o)
}

export async function mkDoc(t: App, typeId: string, warehouseId: string, lines: Line[], over: Record<string, unknown> = {}) {
  return ok(doc(t, typeId, warehouseId, lines, over), 'document')
}

export const entryLines = (t: App, entryId: string) =>
  t.sqlite.prepare(`select a.code, l.debit, l.credit from gl_journal_lines l join coa_accounts a on a.id = l.account_id
    where l.entry_id = ? order by a.code`).all(entryId) as { code: string; debit: string; credit: string }[]

export const costState = (t: App, itemId: string) =>
  t.sqlite.prepare('select quantity, value, average_cost as avg from inv_cost_state where item_id = ?').get(itemId) as
    { quantity: string; value: string; avg: string }
