import { createMiddleware } from 'hono/factory'
import { getAuth } from '../lib/auth.js'

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
