import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export type Mode = 'server' | 'client'

export interface Config {
  mode: Mode | null
  /** Client mode: server address. */
  host: string
  /** Server mode: listening port. Client mode: the server's port. */
  port: number
  /** True once the "closing keeps the server in the tray" notice was shown. */
  trayNoticeShown: boolean
}

const DEFAULTS: Config = { mode: null, host: '', port: 3001, trayNoticeShown: false }

/** Test/automation overrides (documented in docs/prueba-interna.md). */
export const env = {
  mode: process.env.MC_MODE as Mode | undefined,
  port: process.env.MC_PORT ? Number(process.env.MC_PORT) : undefined,
  host: process.env.MC_HOST,
  dataDir: process.env.MC_DATA_DIR,
  /** Skip the login item and the first-run window (needs MC_MODE). */
  noStartup: process.env.MC_NO_STARTUP === '1',
}

const file = () => path.join(app.getPath('userData'), 'mc-config.json')

function readStored(): Partial<Config> {
  try {
    return JSON.parse(fs.readFileSync(file(), 'utf8'))
  } catch {
    return {} // first run or unreadable
  }
}

export function loadConfig(): Config {
  const cfg = { ...DEFAULTS, ...readStored() }
  if (env.mode) cfg.mode = env.mode
  if (env.port) cfg.port = env.port
  if (env.host) cfg.host = env.host
  return cfg
}

export function saveConfig(patch: Partial<Config>): Config {
  const next = { ...DEFAULTS, ...readStored(), ...patch }
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  fs.writeFileSync(file(), JSON.stringify(next, null, 2))
  return loadConfig()
}

/** Server mode: the database lives here, outside the install folder. */
export function dataDir(): string {
  return env.dataDir ?? path.join(app.getPath('userData'), 'data')
}

/** First existing folder of the candidates (packaged layout, then dev layout). */
function firstExisting(...candidates: string[]): string {
  return candidates.find((c) => fs.existsSync(c)) ?? candidates[0]
}

export const serverDir = () =>
  firstExisting(path.join(app.getAppPath(), 'server'), path.join(app.getAppPath(), '..', 'api', 'dist'))
export const uiDir = () =>
  firstExisting(path.join(app.getAppPath(), 'ui'), path.join(app.getAppPath(), '..', 'web', 'out'))
export const assetPath = (name: string) => path.join(app.getAppPath(), 'assets', name)

export function serverUrl(cfg: Config): string {
  const host = cfg.mode === 'server' ? 'localhost' : cfg.host
  return `http://${host}:${cfg.port}`
}
