import { Hono } from 'hono'
import { accountInput, accountUpdate } from '@accounting/shared'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import { createAccount, updateAccount } from '../services/account-commands.js'
import { deactivateAccount, reactivateAccount } from '../services/account-state.js'
import { getAccount, getAccountByCode, listAccounts } from '../services/accounts.js'
import { readJson } from './body.js'

const router = new Hono<ModuleEnv>()

router.get('/', (c) => c.json(listAccounts(c.get('db'), c.get('empresaId'), c.req.query())))

// Registered before /:id so "by-code" is not read as an id.
router.get('/by-code/:code', (c) =>
  c.json(getAccountByCode(c.get('db'), c.get('empresaId'), c.req.param('code'))),
)

router.get('/:id', (c) => c.json(getAccount(c.get('db'), c.get('empresaId'), c.req.param('id'))))

router.post('/', requirePermission('capture'), async (c) => {
  const input = accountInput.parse(await readJson(c))
  return c.json(createAccount(c.get('db'), c.get('empresaId'), c.get('audit'), input), 201)
})

router.patch('/:id', requirePermission('capture'), async (c) => {
  const input = accountUpdate.parse(await readJson(c))
  const id = c.req.param('id')
  return c.json(updateAccount(c.get('db'), c.get('empresaId'), c.get('audit'), id, input))
})

router.post('/:id/deactivate', requirePermission('supervise'), (c) =>
  c.json(deactivateAccount(c.get('db'), c.get('empresaId'), c.get('audit'), c.req.param('id'))),
)

router.post('/:id/reactivate', requirePermission('supervise'), (c) =>
  c.json(reactivateAccount(c.get('db'), c.get('empresaId'), c.get('audit'), c.req.param('id'))),
)

export default router
