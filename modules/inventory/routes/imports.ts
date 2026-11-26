import { Hono } from 'hono'
import { itemImportInput, openingImportInput } from '@accounting/shared'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import { ctxOf } from '../lib/context.js'
import { importItems, importOpening } from '../services/imports.js'
import { readJson } from './body.js'

const router = new Hono<ModuleEnv>()

router.post('/items', requirePermission('inv.import.run'), async (c) =>
  c.json(importItems(ctxOf(c), itemImportInput.parse(await readJson(c)))))

router.post('/opening', requirePermission('inv.import.run'), async (c) =>
  c.json(importOpening(ctxOf(c), openingImportInput.parse(await readJson(c)))))

export default router
