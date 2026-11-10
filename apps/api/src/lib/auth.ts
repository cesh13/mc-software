import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getDb } from '../db/client.js'
import * as schema from '../db/schema.js'

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
    emailAndPassword: { enabled: true },
    session: {
      expiresIn: 8 * 60 * 60,  // 8 hours
      updateAge: 60 * 60,       // refresh if older than 1 hour
      cookieCache: { enabled: false },
    },
    // LAN app: clients connect from any IP/hostname on the network, so we
    // echo back whatever Origin the browser sends as a trusted origin.
    // Better Auth's CSRF guard validates Origin against this list; without
    // it, requests from localhost:3000 (dev) or any LAN IP are rejected (403).
    // NOTE: Better Auth also calls this during init with no request (undefined),
    // so we must guard with optional chaining.
    trustedOrigins: async (request?: Request) => {
      const origin = request?.headers?.get('origin') ?? ''
      return origin ? [origin] : []
    },
    // Expose role + banned fields in session so requireRole middleware can read them
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'member', input: false },
        banned: { type: 'boolean', defaultValue: false, input: false },
        banReason: { type: 'string', required: false, input: false },
        banExpires: { type: 'string', required: false, input: false },
      },
    },
  })
}

type AuthInstance = ReturnType<typeof createAuth>

let _auth: AuthInstance | null = null

export function initAuth(): AuthInstance {
  _auth = createAuth()
  return _auth
}

export function getAuth(): AuthInstance {
  if (!_auth) throw new Error('Auth not initialized')
  return _auth
}
