import { ChildProcess, spawn } from 'child_process'
import { app } from 'electron'
import fs from 'fs'
import http from 'http'
import path from 'path'
import { dataDir, serverDir, uiDir } from './config'
import { log } from './logger'

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'crashed'

let child: ChildProcess | null = null
let status: ServerStatus = 'stopped'
let stopping = false
let attempts = 0
let retryTimer: NodeJS.Timeout | null = null
let port = 3001
const listeners = new Set<(s: ServerStatus) => void>()

export const getStatus = () => status
export const onStatus = (cb: (s: ServerStatus) => void) => void listeners.add(cb)

function setStatus(s: ServerStatus): void {
  if (s === status) return
  status = s
  listeners.forEach((cb) => cb(s))
}

function ping(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 1500 }, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => req.destroy())
  })
}

async function waitReady(proc: ChildProcess): Promise<void> {
  for (let i = 0; i < 120 && child === proc; i++) {
    if (await ping()) {
      if (child === proc) {
        setStatus('running')
        // Stable for a minute: forget previous crashes (resets the backoff).
        setTimeout(() => child === proc && (attempts = 0), 60_000)
      }
      return
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

function spawnServer(): void {
  const dir = serverDir()
  const logDir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(logDir, { recursive: true })
  const out = fs.createWriteStream(path.join(logDir, 'server.log'), { flags: 'a' })

  setStatus('starting')
  // Electron's own runtime acts as Node: no system Node needed.
  const proc = spawn(process.execPath, [path.join(dir, 'server.mjs')], {
    cwd: dir, // native modules resolve from the app's node_modules above ./server
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      ACCOUNTING_DATA_DIR: dataDir(),
      ACCOUNTING_PLATFORM_MIGRATIONS_DIR: path.join(dir, 'migrations'),
      ACCOUNTING_MODULES_DIR: path.join(dir, 'modules'),
      ACCOUNTING_UI_DIR: uiDir(),
      BETTER_AUTH_URL: `http://localhost:${port}`,
      MC_APP_VERSION: app.getVersion(),
    },
  })
  child = proc
  proc.stdout?.pipe(out, { end: false })
  proc.stderr?.pipe(out, { end: false })
  log(`server started pid=${proc.pid} port=${port} data=${dataDir()}`)
  void waitReady(proc)

  proc.on('exit', (code) => {
    out.end()
    if (child === proc) child = null
    log(`server exited code=${code}`)
    if (stopping) return setStatus('stopped')
    setStatus('crashed')
    const delay = Math.min(1000 * 2 ** attempts++, 30_000)
    log(`restarting server in ${delay} ms`)
    retryTimer = setTimeout(spawnServer, delay)
  })
}

export function startServer(listenPort: number): void {
  port = listenPort
  stopping = false
  attempts = 0
  if (!child) spawnServer()
}

/** Asks the API to close the database and exit; kills it after 5 s. */
export function stopServer(): Promise<void> {
  stopping = true
  if (retryTimer) clearTimeout(retryTimer)
  const proc = child
  if (!proc) {
    setStatus('stopped')
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const force = setTimeout(() => proc.kill(), 5000)
    proc.once('exit', () => {
      clearTimeout(force)
      resolve()
    })
    try {
      proc.send('shutdown')
    } catch {
      proc.kill()
    }
  })
}

export async function restartServer(): Promise<void> {
  await stopServer()
  startServer(port)
}

export const waitUntilRunning = (timeoutMs = 60_000): Promise<boolean> =>
  new Promise((resolve) => {
    if (status === 'running') return resolve(true)
    const t = setTimeout(() => resolve(false), timeoutMs)
    onStatus((s) => {
      if (s === 'running') {
        clearTimeout(t)
        resolve(true)
      }
    })
  })
