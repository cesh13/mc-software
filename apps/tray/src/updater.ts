import { app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import fs from 'fs'
import path from 'path'
import { log, updaterLogger } from './logger'

export type UpdateState =
  | { kind: 'disabled' }
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'none' }
  | { kind: 'downloading'; percent: number; version: string }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string }

const FOUR_HOURS = 4 * 60 * 60 * 1000
let state: UpdateState = { kind: 'disabled' }
let manual = false
let promptedFor = ''
const listeners = new Set<() => void>()

export const getUpdateState = () => state
export const onUpdateChange = (cb: () => void) => void listeners.add(cb)

function set(next: UpdateState): void {
  state = next
  listeners.forEach((cb) => cb())
}

/** Spanish one-liner for the tray menu. */
export function describeUpdate(s: UpdateState = state): string {
  switch (s.kind) {
    case 'disabled': return 'Actualizaciones desactivadas (sin servidor de actualizaciones)'
    case 'checking': return 'Buscando actualizaciones…'
    case 'none': return 'Sin novedades: ya tiene la última versión'
    case 'downloading': return `Descargando versión ${s.version} (${s.percent}%)`
    case 'ready': return `Versión ${s.version} lista para instalar`
    case 'error': return 'No se pudo buscar actualizaciones'
    default: return 'Actualizaciones activadas'
  }
}

/** Updates exist only in a packaged build whose feed URL was baked in (app-update.yml). */
function feedConfigured(): boolean {
  return app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))
}

export function initUpdater(opts: { beforeInstall: () => Promise<void> }): void {
  if (!feedConfigured()) {
    log('updates disabled: no app-update.yml (build without MC_UPDATE_URL) or not packaged')
    return
  }
  autoUpdater.logger = updaterLogger
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true // installs on quit if the user never restarts

  autoUpdater.on('checking-for-update', () => set({ kind: 'checking' }))
  autoUpdater.on('update-not-available', () => {
    set({ kind: 'none' })
    if (manual) void dialog.showMessageBox({ message: 'Sin novedades: ya tiene la última versión.' })
    manual = false
  })
  autoUpdater.on('update-available', (i) => set({ kind: 'downloading', percent: 0, version: i.version }))
  autoUpdater.on('download-progress', (p) => {
    if (state.kind === 'downloading') set({ ...state, percent: Math.round(p.percent) })
  })
  autoUpdater.on('error', (e) => {
    set({ kind: 'error', message: String(e?.message ?? e) })
    if (manual) void dialog.showMessageBox({ type: 'warning', message: 'No se pudo buscar actualizaciones.', detail: String(e?.message ?? e) })
    manual = false
  })
  autoUpdater.on('update-downloaded', (i) => {
    set({ kind: 'ready', version: i.version })
    manual = false
    if (promptedFor === i.version) return
    promptedFor = i.version
    // Never interrupt: ask, and install on quit if the answer is "later".
    void dialog
      .showMessageBox({
        type: 'question',
        buttons: ['Reiniciar ahora', 'Más tarde'],
        defaultId: 1,
        cancelId: 1,
        message: `La versión ${i.version} está lista para instalar.`,
        detail: 'Si elige "Más tarde", se instalará al cerrar el programa.',
      })
      .then((r) => {
        if (r.response === 0) void installNow(opts.beforeInstall)
      })
  })

  set({ kind: 'idle' })
  void checkNow(false)
  setInterval(() => void checkNow(false), FOUR_HOURS)
}

export async function checkNow(isManual: boolean): Promise<void> {
  if (state.kind === 'disabled') {
    if (isManual) {
      await dialog.showMessageBox({
        message: 'Las actualizaciones están desactivadas.',
        detail: 'Esta compilación no tiene configurada la dirección del servidor de actualizaciones.',
      })
    }
    return
  }
  if (state.kind === 'checking' || state.kind === 'downloading') return
  if (state.kind === 'ready') {
    if (isManual) await dialog.showMessageBox({ message: `La versión ${state.version} ya está lista para instalar.` })
    return
  }
  manual = isManual
  try {
    await autoUpdater.checkForUpdates()
  } catch {
    // reported through the 'error' event
  }
}

export async function installNow(beforeInstall: () => Promise<void>): Promise<void> {
  if (state.kind !== 'ready') return
  await beforeInstall() // stop the API child before the installer touches files
  autoUpdater.quitAndInstall(true, true)
}
