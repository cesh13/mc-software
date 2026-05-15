import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { settings } from '../db/schema.js'
import { requireRole } from '../middleware/auth.js'

const DEFAULT_SETTINGS: Record<string, string> = {
  port: '3001',
  appName: 'Accounting Platform',
}

const appSettings = new Hono()

appSettings.get('/', requireRole('owner'), async (c) => {
  const db = getDb()
  const rows = await db.select().from(settings)
  const result: Record<string, string> = { ...DEFAULT_SETTINGS }
  for (const row of rows) result[row.key] = row.value
  return c.json(result)
})

appSettings.patch('/', requireRole('owner'), async (c) => {
  const db = getDb()
  const body = await c.req.json<Record<string, string>>()
  const now = new Date().toISOString()

  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(settings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
  }

  return c.json({ success: true })
})

export default appSettings
