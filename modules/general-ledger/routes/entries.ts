import { Hono } from 'hono'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import {
  copyEntryInput,
  entryInput,
  entryListQuery,
  nextNumberQuery,
  unbalancedQuery,
  type NextNumber,
} from '@accounting/shared'
import { ctxOf } from '../lib/context.js'
import { respond } from '../lib/errors.js'
import { listEntries, unbalancedEntries } from '../services/entries-read.js'
import { getEntry } from '../services/entry-detail.js'
import { createEntry, updateEntry } from '../services/entries-write.js'
import { applyEntry, copyEntry, unapplyEntry, voidEntry } from '../services/entry-actions.js'
import { activeEntryType } from '../services/entry-rules.js'
import { nextNumber } from '../services/numbering.js'

const router = new Hono<ModuleEnv>()

// Static paths first: they would otherwise match /entries/:id.
router.get('/entries', requirePermission('gl.entry.view'), (c) => c.json(listEntries(ctxOf(c), entryListQuery.parse(c.req.query()))))
router.get('/entries/next-number', requirePermission('gl.entry.view'), (c) => {
  const q = nextNumberQuery.parse(c.req.query())
  const ctx = ctxOf(c)
  const type = activeEntryType(ctx, q.entryTypeId)
  const body: NextNumber = { period: q.period, entryTypeId: type.id, number: nextNumber(ctx, q.period, type) }
  return c.json(body)
})
router.get('/entries/unbalanced', requirePermission('gl.report.view'), (c) =>
  c.json(unbalancedEntries(ctxOf(c), unbalancedQuery.parse(c.req.query()).period)),
)
router.get('/entries/:id', requirePermission('gl.entry.view'), (c) => c.json(getEntry(ctxOf(c), c.req.param('id'))))

router.post('/entries', requirePermission('gl.entry.create'), async (c) => {
  const input = entryInput.parse(await c.req.json())
  return respond(c, () => createEntry(ctxOf(c), input), 201)
})
router.put('/entries/:id', requirePermission('gl.entry.update'), async (c) => {
  const input = entryInput.parse(await c.req.json())
  return respond(c, () => updateEntry(ctxOf(c), c.req.param('id'), input))
})
router.post('/entries/:id/apply', requirePermission('gl.entry.apply'), (c) =>
  respond(c, () => applyEntry(ctxOf(c), c.req.param('id'))),
)
router.post('/entries/:id/unapply', requirePermission('gl.entry.unapply'), (c) =>
  c.json(unapplyEntry(ctxOf(c), c.req.param('id'))),
)
router.post('/entries/:id/void', requirePermission('gl.entry.void'), (c) =>
  c.json(voidEntry(ctxOf(c), c.req.param('id'))),
)
router.post('/entries/:id/copy', requirePermission('gl.entry.create'), async (c) => {
  const input = copyEntryInput.parse(await c.req.json())
  return c.json(copyEntry(ctxOf(c), c.req.param('id'), input), 201)
})

export default router
