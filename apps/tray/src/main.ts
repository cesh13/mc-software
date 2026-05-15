import { app, Tray, Menu, shell, nativeImage } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import { startServer, stopServer, restartServer, isRunning } from './server-manager'

let tray: Tray | null = null
let serverReady = false
const PORT = process.env.PORT ?? '3001'

function getAppUrl(): string {
  return `http://localhost:${PORT}`
}

function buildMenu(): void {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open in Browser',
      enabled: serverReady,
      click: () => shell.openExternal(getAppUrl()),
    },
    { type: 'separator' },
    {
      label: serverReady ? `Running on :${PORT}` : 'Starting…',
      enabled: false,
    },
    {
      label: `Version ${app.getVersion()}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => autoUpdater.checkForUpdates(),
    },
    {
      label: 'Restart Server',
      click: () => {
        serverReady = false
        buildMenu()
        restartServer(() => {
          serverReady = true
          buildMenu()
        })
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: async () => {
        await stopServer()
        app.quit()
      },
    },
  ])
  tray?.setContextMenu(menu)
}

function createTray(): void {
  // Use a blank 16x16 image as placeholder — replace with actual icon asset
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('Accounting Platform')
  buildMenu()
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', () => {
    tray?.setToolTip('Accounting Platform — update available')
  })

  autoUpdater.on('update-downloaded', () => {
    tray?.setToolTip('Accounting Platform — restart to update')
    const menu = tray?.getContextMenu()
    // Rebuild menu with install prompt
    buildMenu()
  })

  // Check on startup + every 4 hours
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000)
}

app.whenReady().then(() => {
  // Prevent app from appearing in macOS Dock
  if (process.platform === 'darwin') app.dock?.hide()

  // Register to start on login
  app.setLoginItemSettings({ openAtLogin: true })

  createTray()

  startServer(
    () => {
      serverReady = true
      buildMenu()
    },
    () => {
      serverReady = false
      buildMenu()
    },
  )

  if (app.isPackaged) setupAutoUpdater()
})

app.on('window-all-closed', (e: Event) => {
  // Prevent default quit — tray app stays alive
  e.preventDefault()
})
