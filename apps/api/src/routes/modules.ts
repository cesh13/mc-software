import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { modules } from '../db/schema.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const modulesRoute = new Hono()

modulesRoute.get('/', requireAuth, async (c) => {
  const db = getDb()
  const all = await db.select().from(modules)
  return c.json(all)
})

modulesRoute.post('/:id/enable', requireRole('owner'), async (c) => {
  const db = getDb()
  const { id } = c.req.param()

  const existing = await db
    .select()
    .from(modules)
    .where(eq(modules.id, id))
    .limit(1)

  if (existing.length === 0) return c.json({ error: 'Module not found' }, 404)
  if (existing[0].isAlwaysOn) return c.json({ error: 'Module is always on' }, 400)

  await db
    .update(modules)
    .set({ isEnabled: true, enabledAt: new Date().toISOString() })
    .where(eq(modules.id, id))

  return c.json({ success: true })
})

modulesRoute.post('/:id/disable', requireRole('owner'), async (c) => {
  const db = getDb()
  const { id } = c.req.param()

  const existing = await db
    .select()
    .from(modules)
    .where(eq(modules.id, id))
    .limit(1)

  if (existing.length === 0) return c.json({ error: 'Module not found' }, 404)
  if (existing[0].isAlwaysOn) return c.json({ error: 'Cannot disable always-on module' }, 400)

  await db
    .update(modules)
    .set({ isEnabled: false })
    .where(eq(modules.id, id))

  return c.json({ success: true, restartRequired: true })
})

export default modulesRoute
