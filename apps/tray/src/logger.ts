import { app } from 'electron'
import fs from 'fs'
import path from 'path'

let stream: fs.WriteStream | null = null

function open(): fs.WriteStream {
  if (!stream) {
    const dir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(dir, { recursive: true })
    stream = fs.createWriteStream(path.join(dir, 'main.log'), { flags: 'a' })
  }
  return stream
}

export function log(...parts: unknown[]): void {
  const line = `${new Date().toISOString()} ${parts.map(String).join(' ')}\n`
  process.stdout.write(line)
  try {
    open().write(line)
  } catch {
    // logging must never break the app
  }
}

/** Adapter for electron-updater's logger interface. */
export const updaterLogger = {
  info: (m: unknown) => log('[updater]', m),
  warn: (m: unknown) => log('[updater] WARN', m),
  error: (m: unknown) => log('[updater] ERROR', m),
  debug: (m: unknown) => log('[updater] debug', m),
}
