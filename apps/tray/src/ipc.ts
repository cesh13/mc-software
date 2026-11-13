import { app, ipcMain } from 'electron'
import http from 'http'
import { loadConfig, saveConfig } from './config'
import { closeSetupWindow, openSetupWindow, retryMain } from './windows'

const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/

export interface HealthResult {
  ok: boolean
  message: string
  version?: string | null
}

/** GET /health on a candidate server; used by the setup page and the version check. */
export function probeServer(host: string, port: number): Promise<HealthResult> {
  return new Promise((resolve) => {
    if (!HOST_RE.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
      return resolve({ ok: false, message: 'Dirección o puerto no válidos.' })
    }
    const req = http.get({ host, port, path: '/health', timeout: 4000 }, (res) => {
      let body = ''
      res.on('data', (d) => (body += d))
      res.on('end', () => {
        try {
          const j = JSON.parse(body)
          if (res.statusCode === 200 && j.ok) {
            return resolve({ ok: true, message: 'Conexión correcta.', version: j.version ?? null })
          }
        } catch {
          // not our server
        }
        resolve({ ok: false, message: 'Respondió algo que no es MC Software.' })
      })
    })
    req.on('error', () => resolve({ ok: false, message: 'No se pudo conectar. Revise la dirección, el puerto y el cortafuegos.' }))
    req.on('timeout', () => req.destroy())
  })
}

/** `applyChange` restarts the app so the new mode takes effect cleanly. */
export function registerIpc(applyChange: () => void): void {
  ipcMain.handle('mc:info', () => {
    const c = loadConfig()
    return { host: c.host, port: c.port, mode: c.mode, version: app.getVersion() }
  })
  ipcMain.handle('mc:test', (_e, host: string, port: number) => probeServer(String(host), Number(port)))
  ipcMain.handle('mc:save', (_e, v: { mode: 'server' | 'client'; host?: string; port?: number }) => {
    if (v.mode === 'client') {
      const host = String(v.host ?? '').trim()
      const port = Number(v.port)
      if (!HOST_RE.test(host) || !(port >= 1 && port <= 65535)) throw new Error('Dirección o puerto no válidos.')
      saveConfig({ mode: 'client', host, port })
    } else {
      saveConfig({ mode: 'server', port: loadConfig().mode === 'server' ? loadConfig().port : 3001 })
    }
    closeSetupWindow()
    applyChange()
  })
  ipcMain.handle('mc:retry', () => retryMain())
  ipcMain.handle('mc:change', () => void openSetupWindow())
  ipcMain.handle('mc:cancel', () => closeSetupWindow())
}
