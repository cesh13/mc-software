import { Hono } from 'hono'
import { budgetGroupInput, budgetGroupUpdate } from '@accounting/shared'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import {
  createBudgetGroup,
  listBudgetGroups,
  setBudgetGroupActive,
  updateBudgetGroup,
} from '../services/budget-groups.js'
import { readJson } from './body.js'

const router = new Hono<ModuleEnv>()

router.get('/', (c) => {
  const flag = c.req.query('includeInactive')
  return c.json(listBudgetGroups(c.get('db'), c.get('empresaId'), flag === '1' || flag === 'true'))
})

router.post('/', requirePermission('capture'), async (c) => {
  const input = budgetGroupInput.parse(await readJson(c))
  return c.json(createBudgetGroup(c.get('db'), c.get('empresaId'), c.get('audit'), input), 201)
})

router.patch('/:id', requirePermission('capture'), async (c) => {
  const input = budgetGroupUpdate.parse(await readJson(c))
  const id = c.req.param('id')
  return c.json(updateBudgetGroup(c.get('db'), c.get('empresaId'), c.get('audit'), id, input))
})

router.post('/:id/deactivate', requirePermission('supervise'), (c) => {
  const id = c.req.param('id')
  return c.json(setBudgetGroupActive(c.get('db'), c.get('empresaId'), c.get('audit'), id, false))
})

router.post('/:id/reactivate', requirePermission('supervise'), (c) => {
  const id = c.req.param('id')
  return c.json(setBudgetGroupActive(c.get('db'), c.get('empresaId'), c.get('audit'), id, true))
})

export default router
