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
  const authBase = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001'

  try {
    // Call auth.handler with a synthetic Request so sign-up goes through
    // the exact same code path as a real browser request. This avoids the
    // raw auth.api.* server-side calling convention, which requires an
    // internal request context that is tricky to construct manually.
    const signUpReq = new Request(`${authBase}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })

    const signUpRes = await auth.handler(signUpReq)

    if (!signUpRes.ok) {
      const errText = await signUpRes.text()
      console.error('[setup] sign-up failed:', signUpRes.status, errText)
      return c.json({ error: `Sign-up failed (${signUpRes.status}): ${errText}` }, 500)
    }

    const responseData = (await signUpRes.json()) as { user?: { id?: string } }
    const userId = responseData?.user?.id

    if (!userId) {
      console.error('[setup] no user ID in sign-up response:', responseData)
      return c.json({ error: 'User created but no ID returned — check server logs' }, 500)
    }

    // Elevate to owner role (Better Auth always assigns defaultValue 'member')
    await db
      .update(user)
      .set({ role: 'owner', updatedAt: new Date() })
      .where(eq(user.id, userId))

    return c.json({ success: true })
  } catch (err) {
    console.error('[setup] error:', err)
    return c.json({ error: String(err) }, 500)
  }
})

export default setup
