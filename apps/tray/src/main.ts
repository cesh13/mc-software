import { app, Menu } from 'electron'
import path from 'path'
import { env, loadConfig, saveConfig, serverUrl, type Config } from './config'
import { probeServer, registerIpc } from './ipc'
import { log } from './logger'
import { getStatus, onStatus, restartServer, startServer, stopServer, waitUntilRunning } from './server-manager'
import { balloon, createTray, refreshTray } from './tray'
import { checkNow, initUpdater, installNow, onUpdateChange } from './updater'
import { hasMainWindow, notify, openMainWindow, openSetupWindow, setCloseHook, showMain } from './windows'

// Deterministic profile folder (the package name would give "@accounting/tray").
app.setPath('userData', process.env.MC_USER_DATA ?? path.join(app.getPath('appData'), 'MC Software'))

let quitting = false
let started = false // false during first-run setup: no relaunch needed

async function shutdown(): Promise<void> {
  quitting = true
  await stopServer()
}

/** Restart the whole app so a mode/server change starts from a clean state. */
function relaunch(): void {
  if (!started) return
  quitting = true
  void stopServer().then(() => {
    app.relaunch()
    app.exit(0)
  })
}

function buildAppMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Archivo',
        submenu: [
          { label: 'Buscar actualizaciones', click: () => void checkNow(true) },
          { label: 'Cambiar modo / servidor…', click: () => void openSetupWindow() },
          { type: 'separator' },
          { label: 'Salir', click: () => app.quit() },
        ],
      },
      {
        label: 'Ver',
        submenu: [
          { role: 'reload', label: 'Recargar' },
          { role: 'togglefullscreen', label: 'Pantalla completa' },
          { role: 'zoomIn', label: 'Acercar' },
          { role: 'zoomOut', label: 'Alejar' },
          { role: 'resetZoom', label: 'Tamaño normal' },
        ],
      },
    ]),
  )
}

const parts = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0)
function isOlder(mine: string, theirs: string): boolean {
  const [a, b] = [parts(mine), parts(theirs)]
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0)
  return false
}

/** Client shell older than the server: the UI comes from the server, so just tell the user. */
async function checkVersionAgainstServer(cfg: Config): Promise<void> {
  const r = await probeServer(cfg.host, cfg.port)
  if (!r.ok || !r.version) return
  const older = isOlder(app.getVersion(), r.version)
  if (older) {
    log(`client ${app.getVersion()} is older than server ${r.version}`)
    notify(
      `El servidor usa la versión ${r.version} y este programa la ${app.getVersion()}.`,
      'Se buscarán actualizaciones. Si algo no se ve bien, instale la versión nueva.',
    )
    void checkNow(false)
  }
}

async function runServerMode(cfg: Config): Promise<void> {
  const actions = {
    open: () => (hasMainWindow() ? showMain() : openMainWindow(serverUrl(cfg))),
    checkUpdates: () => void checkNow(true),
    installUpdate: () => void installNow(shutdown),
    restartServer: () => void restartServer(),
    changeMode: () => void openSetupWindow(),
    quit: () => app.quit(),
  }
  createTray(cfg, actions)
  onStatus(refreshTray)
  onUpdateChange(refreshTray)
  setCloseHook(() => {
    if (quitting || cfg.trayNoticeShown) return
    saveConfig({ trayNoticeShown: true })
    cfg.trayNoticeShown = true
    balloon('MC Software sigue en ejecución', 'El servidor continúa activo en la bandeja del sistema. Use "Salir" en su menú para cerrarlo.')
  })

  startServer(cfg.port)
  if (!env.noStartup) app.setLoginItemSettings({ openAtLogin: true })
  if (await waitUntilRunning()) {
    openMainWindow(serverUrl(cfg))
    initUpdater({ beforeInstall: shutdown })
  } else {
    log('server did not become ready in time')
    openMainWindow(serverUrl(cfg)) // shows the "cannot connect" page with Retry
  }
}

function runClientMode(cfg: Config): void {
  if (!env.noStartup) app.setLoginItemSettings({ openAtLogin: false })
  setCloseHook(() => app.quit())
  openMainWindow(serverUrl(cfg))
  initUpdater({ beforeInstall: shutdown })
  void checkVersionAgainstServer(cfg)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMain())
  // Closing windows never quits by itself; each mode decides (see setCloseHook).
  app.on('window-all-closed', () => undefined)
  app.on('before-quit', (e) => {
    if (quitting || getStatus() === 'stopped') return
    e.preventDefault()
    void shutdown().then(() => app.quit())
  })

  void app.whenReady().then(async () => {
    registerIpc(relaunch)
    buildAppMenu()
    let cfg = loadConfig()
    if (!cfg.mode) {
      await openSetupWindow() // saving restarts the app via relaunch()
      cfg = loadConfig()
      if (!cfg.mode) return app.quit()
    }
    started = true
    log(`starting v${app.getVersion()} mode=${cfg.mode} port=${cfg.port}`)
    if (cfg.mode === 'server') await runServerMode(cfg)
    else runClientMode(cfg)
    // Automation hook: lets a scripted run exercise the normal quit path.
    const quitAfter = Number(process.env.MC_TEST_QUIT_AFTER_MS)
    if (quitAfter > 0) setTimeout(() => app.quit(), quitAfter)
  })
}
