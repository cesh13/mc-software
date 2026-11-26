import { Hono } from 'hono'
import type { z } from 'zod'
import { groupInput, movementTypeInput, warehouseInput } from '@accounting/shared'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import { ctxOf } from '../lib/context.js'
import { groups, movementTypes, warehouses } from '../services/catalogs.js'
import { readJson } from './body.js'

type Crud = typeof warehouses | typeof groups | typeof movementTypes

// GET / · POST / · PATCH /:id · POST /:id/deactivate · POST /:id/reactivate
function crudRouter(svc: Crud, schema: z.ZodObject) {
  const r = new Hono<ModuleEnv>()
  r.get('/', requirePermission('inv.config.view'), (c) => c.json(svc.list(ctxOf(c), c.req.query('inactive') === '1')))
  r.get('/:id', requirePermission('inv.config.view'), (c) => c.json(svc.get(ctxOf(c), c.req.param('id'))))
  r.post('/', requirePermission('inv.config.manage'), async (c) =>
    c.json(svc.create(ctxOf(c), schema.parse(await readJson(c)) as never), 201))
  r.patch('/:id', requirePermission('inv.config.manage'), async (c) =>
    c.json(svc.update(ctxOf(c), c.req.param('id'), schema.partial().parse(await readJson(c)) as never)))
  r.post('/:id/deactivate', requirePermission('inv.config.manage'), (c) =>
    c.json(svc.setActive(ctxOf(c), c.req.param('id'), false)))
  r.post('/:id/reactivate', requirePermission('inv.config.manage'), (c) =>
    c.json(svc.setActive(ctxOf(c), c.req.param('id'), true)))
  return r
}

export const warehousesRouter = crudRouter(warehouses, warehouseInput)
export const groupsRouter = crudRouter(groups, groupInput)
export const movementTypesRouter = crudRouter(movementTypes, movementTypeInput)
