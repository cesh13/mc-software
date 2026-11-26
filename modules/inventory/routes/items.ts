import { Hono } from 'hono'
import { itemInput, itemListQuery, itemUpdate } from '@accounting/shared'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import { ctxOf } from '../lib/context.js'
import { createItem, getItem, listItems, setItemActive, updateItem } from '../services/items.js'
import { costState } from '../services/cost.js'
import { onHand } from '../services/stock.js'
import { readJson } from './body.js'

const router = new Hono<ModuleEnv>()

router.get('/', requirePermission('inv.item.view'), (c) => c.json(listItems(ctxOf(c), itemListQuery.parse(c.req.query()))))

router.get('/:id', requirePermission('inv.item.view'), (c) => c.json(getItem(ctxOf(c), c.req.param('id'))))

// Current stock (and average cost with inv.cost.view), for the capture grid.
router.get('/:id/stock', requirePermission('inv.item.view'), (c) => {
  const ctx = ctxOf(c)
  const id = c.req.param('id')
  getItem(ctx, id)
  const warehouseId = c.req.query('warehouseId') || undefined
  const lotNo = c.req.query('lotNo') || undefined
  const st = costState(ctx, id)
  return c.json({
    onHand: onHand(ctx, { itemId: id, warehouseId, lotNo }),
    total: st.quantity,
    averageCost: ctx.can('inv.cost.view') ? st.averageCost : null,
    lastCost: ctx.can('inv.cost.view') ? st.lastCost : null,
  })
})

router.post('/', requirePermission('inv.item.manage'), async (c) =>
  c.json(createItem(ctxOf(c), itemInput.parse(await readJson(c))), 201))

router.patch('/:id', requirePermission('inv.item.manage'), async (c) =>
  c.json(updateItem(ctxOf(c), c.req.param('id'), itemUpdate.parse(await readJson(c)))))

router.post('/:id/deactivate', requirePermission('inv.item.deactivate'), (c) =>
  c.json(setItemActive(ctxOf(c), c.req.param('id'), false)))

router.post('/:id/reactivate', requirePermission('inv.item.deactivate'), (c) =>
  c.json(setItemActive(ctxOf(c), c.req.param('id'), true)))

export default router
