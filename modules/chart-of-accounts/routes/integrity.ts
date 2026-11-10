import { Hono } from 'hono'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import { checkIntegrity } from '../services/integrity.js'

const router = new Hono<ModuleEnv>()

router.get('/', requirePermission('reports'), (c) =>
  c.json(checkIntegrity(c.get('db'), c.get('empresaId'))),
)

export default router
