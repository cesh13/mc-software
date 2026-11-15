import { Hono } from 'hono'
import { partyInput, partyListQuery, partyUpdate } from '@accounting/shared'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import { getParty, listParties } from '../services/parties-read.js'
import { createParty, setPartyActive, updateParty } from '../services/parties-write.js'
import { readJson } from './body.js'

const router = new Hono<ModuleEnv>()

router.get('/', requirePermission('pty.party.view'), (c) => {
  const query = partyListQuery.parse(c.req.query())
  return c.json(listParties(c.get('db'), c.get('empresaId'), query))
})

router.get('/:id', requirePermission('pty.party.view'), (c) =>
  c.json(getParty(c.get('db'), c.get('empresaId'), c.req.param('id'))),
)

router.post('/', requirePermission('pty.party.create'), async (c) => {
  const input = partyInput.parse(await readJson(c))
  return c.json(createParty(c.get('db'), c.get('empresaId'), c.get('audit'), input), 201)
})

router.patch('/:id', requirePermission('pty.party.update'), async (c) => {
  const input = partyUpdate.parse(await readJson(c))
  const id = c.req.param('id')
  return c.json(updateParty(c.get('db'), c.get('empresaId'), c.get('audit'), id, input))
})

router.post('/:id/deactivate', requirePermission('pty.party.deactivate'), (c) =>
  c.json(setPartyActive(c.get('db'), c.get('empresaId'), c.get('audit'), c.req.param('id'), false)),
)

router.post('/:id/reactivate', requirePermission('pty.party.deactivate'), (c) =>
  c.json(setPartyActive(c.get('db'), c.get('empresaId'), c.get('audit'), c.req.param('id'), true)),
)

export default router
