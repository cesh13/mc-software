import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { getAuth } from '../lib/auth.js'
import { user } from '../db/schema.js'

const setup = new Hono()

setup.get('/status', async (c) => {
  const db = getDb()
  const firstUser = await db.select({ id: user.id }).from(user).limit(1)
  return c.json({ needsSetup: firstUser.length === 0 })
})

// Disabled after first use — enforced by the needsSetup check
setup.post('/complete', async (c) => {
  const db = getDb()
  const existing = await db.select({ id: user.id }).from(user).limit(1)
  if (existing.length > 0) {
    return c.json({ error: 'Setup already complete' }, 400)
  }

  const { name, email, password } = await c.req.json<{
    name: string
    email: string
    password: string
  }>()

  const auth = getAuth()
  const result = await auth.api.signUpEmail({
    body: { name, email, password },
  })

  // Promote the first account to owner directly in the DB
  await db
    .update(user)
    .set({ role: 'owner', updatedAt: new Date().toISOString() })
    .where(eq(user.id, result.user.id))

  return c.json({ success: true })
})

export default setup
