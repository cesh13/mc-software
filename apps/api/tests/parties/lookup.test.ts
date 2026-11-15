import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { PartiesLookup } from '@accounting/shared'
import type { Db } from '@accounting/shared/server'
import { act, addEmpresa, app, mk } from './helpers.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const lookupFile = path.resolve(here, '..', '..', '..', '..', 'modules', 'parties', 'services', 'lookup.ts')

// Loaded the way a consumer module would get it from the service registry.
async function factory(): Promise<(ctx: { empresaId: string }) => PartiesLookup<Db>> {
  const mod = (await import(pathToFileURL(lookupFile).href)) as {
    createPartiesLookup: (ctx: { empresaId: string }) => PartiesLookup<Db>
  }
  return mod.createPartiesLookup
}

test('lookup: get, byNrc and search stay inside the empresa', async () => {
  const t = await app()
  addEmpresa(t, 'e2', 'DOS')
  const a = await mk(t, 'A', { name: 'Alfa', nrc: '123456-7', isSupplier: true })
  const off = await mk(t, 'B', { name: 'Beta', nrc: '222-2' })
  await act(t, `/${off.id}/deactivate`)
  const foreign = await mk(t, 'Z', { name: 'Alfa ajena', nrc: '999-9' }, { empresaId: 'e2' })

  const lookup = (await factory())({ empresaId: t.empresaId })
  const info = lookup.get(t.db, a.id)
  assert.deepEqual(info, {
    id: a.id, code: 'A', name: 'Alfa', kind: 'company', nit: null, nrc: '123456-7', dui: null,
    isCustomer: true, isSupplier: true, isForeign: false, isActive: true,
  })
  assert.equal(lookup.get(t.db, foreign.id), null)
  assert.equal(lookup.byNrc(t.db, '1234567')?.id, a.id)
  assert.equal(lookup.byNrc(t.db, '999-9'), null)
  assert.equal(lookup.byNrc(t.db, '222-2')?.isActive, false)
  assert.equal(lookup.byNrc(t.db, ''), null)
  assert.deepEqual(lookup.search(t.db, 'alfa').map((p) => p.code), ['A'])
  assert.deepEqual(lookup.search(t.db, 'beta'), [])

  // Works inside a transaction too.
  t.db.transaction((tx) => {
    assert.equal(lookup.get(tx as unknown as Db, a.id)?.code, 'A')
  })
})
