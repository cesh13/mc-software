import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
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
    emailAndPassword: { enabled: true },
    session: {
      expiresIn: 8 * 60 * 60,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    plugins: [
      admin({
        defaultRole: 'member',
        adminRoles: ['owner', 'admin'],
      }),
    ],
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
