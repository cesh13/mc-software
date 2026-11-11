import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { openDatabase } from './db/client.js'
import { runPlatformMigrations } from './db/migrate.js'
import { initAuth, getAuth } from './lib/auth.js'
import { loadModules } from './lib/module-loader.js'
import { handleError, type PlatformDeps } from './middleware/module-context.js'
import { sessionUser } from './middleware/auth.js'
import { getDb } from './db/client.js'
import { createEmpresasRoute } from './routes/empresas.js'
import type { Db } from '@accounting/shared/server'
import { getSettings } from './lib/settings.js'
import setup from './routes/setup.js'
import modulesRoute from './routes/modules.js'
import { createUsersRoute } from './routes/users.js'
import appSettings from './routes/app-settings.js'

async function start() {
  // 1. Open encrypted DB
  await openDatabase()

  // 2. Run platform migrations (platform tables always first)
  await runPlatformMigrations()

  // 3. Initialize auth (needs open DB)
  initAuth()

  const app = new Hono()
  app.onError(handleError)
  const deps: PlatformDeps = { db: () => getDb() as unknown as Db, resolveUser: sessionUser }

  // Allow any LAN origin to reach the API (clients connect by IP/hostname).
  // Echo back whatever Origin is sent — required so credentials work on any
  // LAN address without hardcoding IPs. A wildcard '*' + credentials is
  // forbidden by the CORS spec and silently breaks cookie-based auth.
  app.use('*', cors({ origin: (o) => o, credentials: true }))

  // 4. Platform routes
  app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))
  app.route('/api/setup', setup)
  app.route('/api/modules', modulesRoute)
  app.route('/api/users', createUsersRoute(deps))
  app.route('/api/settings', appSettings)
  app.route('/api/empresas', createEmpresasRoute(deps))

  // Better Auth handles /api/auth/* itself
  app.on(['GET', 'POST'], '/api/auth/*', (c) => getAuth().handler(c.req.raw))

  // 5. Load enabled modules (their migrations → routes) in dependency order
  const loaded = await loadModules(app, deps)
  console.log(`Modules loaded: ${loaded.join(', ') || 'none'}`)

  // 6. Serve built Next.js static files
  // In production the tray app sets ACCOUNTING_UI_DIR.
  // In dev, Next.js runs separately on its own port.
  const uiDir = process.env.ACCOUNTING_UI_DIR
  if (uiDir) {
    app.use('*', serveStatic({ root: uiDir }))
    // Fallback: serve index.html for SPA navigation
    app.use('*', serveStatic({ path: `${uiDir}/index.html` }))
  }

  // 7. Listen
  const port = Number(process.env.PORT ?? (await getSettings('port')) ?? 3001)
  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
    console.log(`Accounting Platform API running on http://0.0.0.0:${info.port}`)
  })
}

start().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
