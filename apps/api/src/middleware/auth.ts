import { createMiddleware } from 'hono/factory'
import type { CurrentUser } from '@accounting/shared/server'
import { getAuth } from '../lib/auth.js'

// Current user from the Better Auth session cookie, or null.
export async function sessionUser(headers: Headers): Promise<CurrentUser | null> {
  const session = await getAuth().api.getSession({ headers })
  if (!session) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = session.user as any
  if (u.banned) return null
  return { id: u.id, name: u.name, email: u.email, role: u.role ?? 'consulta' }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  c.set('user', session.user)
  c.set('session', session.session)
  await next()
})

export const requireRole = (...roles: string[]) =>
  createMiddleware(async (c, next) => {
    const auth = getAuth()
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: 'Unauthorized' }, 401)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (session.user as any).role as string | undefined
    if (!role || !roles.includes(role)) return c.json({ error: 'Forbidden' }, 403)
    c.set('user', session.user)
    c.set('session', session.session)
    await next()
  })
