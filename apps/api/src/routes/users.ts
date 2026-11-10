import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { user } from '../db/schema.js'
import { requireRole } from '../middleware/auth.js'
import { ROLES, type Role } from '@accounting/shared'

const VALID_ROLES: readonly Role[] = ROLES

const users = new Hono()

users.get('/', requireRole('owner', 'admin', 'supervisor'), async (c) => {
  const db = getDb()
  const all = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned })
    .from(user)
  return c.json(all)
})

users.post('/', requireRole('owner'), async (c) => {
  const { name, email, password, role } = await c.req.json<{
    name: string
    email: string
    password: string
    role: Role
  }>()

  if (!VALID_ROLES.includes(role)) return c.json({ error: 'Invalid role' }, 400)

  const { getAuth } = await import('../lib/auth.js')
  const result = await getAuth().api.signUpEmail({ body: { name, email, password } })

  const db = getDb()
  await db
    .update(user)
    .set({ role, updatedAt: new Date().toISOString() })
    .where(eq(user.id, result.user.id))

  return c.json({ id: result.user.id, name, email, role }, 201)
})

users.patch('/:id', requireRole('owner'), async (c) => {
  const db = getDb()
  const { id } = c.req.param()
  const body = await c.req.json<Partial<{ name: string; role: Role; banned: boolean }>>()

  const existing = await db.select({ id: user.id }).from(user).where(eq(user.id, id)).limit(1)
  if (existing.length === 0) return c.json({ error: 'User not found' }, 404)

  if (body.role && !VALID_ROLES.includes(body.role)) return c.json({ error: 'Invalid role' }, 400)

  await db
    .update(user)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(user.id, id))

  return c.json({ success: true })
})

export default users
