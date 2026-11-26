import { Hono } from 'hono'
import { z } from 'zod'
import { documentInput, documentListQuery, voidDocumentInput } from '@accounting/shared'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import { ctxOf, type Ctx } from '../lib/context.js'
import { getDocument, listDocuments, redactCosts } from '../services/documents-read.js'
import { createDocument, voidDocument } from '../services/documents-write.js'
import { readJson } from './body.js'

const router = new Hono<ModuleEnv>()

const show = (ctx: Ctx, id: string) => {
  const doc = getDocument(ctx, id)
  return ctx.can('inv.cost.view') ? doc : redactCosts(doc)
}

router.get('/', requirePermission('inv.document.view'), (c) => {
  const ctx = ctxOf(c)
  const rows = listDocuments(ctx, documentListQuery.parse(c.req.query()))
  return c.json(ctx.can('inv.cost.view') ? rows : rows.map((r) => redactCosts(r)))
})

router.get('/:id', requirePermission('inv.document.view'), (c) => c.json(show(ctxOf(c), c.req.param('id'))))

router.post('/', requirePermission('inv.document.create'), async (c) => {
  const ctx = ctxOf(c)
  const id = createDocument(ctx, documentInput.parse(await readJson(c)))
  return c.json(show(ctx, id), 201)
})

const voidInput = voidDocumentInput.extend({ allowNegative: z.boolean().optional() })

router.post('/:id/void', requirePermission('inv.document.void'), async (c) => {
  const ctx = ctxOf(c)
  const input = voidInput.parse(await readJson(c))
  voidDocument(ctx, c.req.param('id'), input.reason, input.allowNegative)
  return c.json(show(ctx, c.req.param('id')))
})

export default router
