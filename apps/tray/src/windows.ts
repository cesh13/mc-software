import { BrowserWindow, dialog } from 'electron'
import path from 'path'
import { assetPath } from './config'
import { log } from './logger'

let main: BrowserWindow | null = null
let setup: BrowserWindow | null = null
let currentUrl = ''
let onCloseHook: (() => void) | null = null

const webPrefs = () => ({
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
})

/** Server mode: closing the window keeps the server alive in the tray. */
export function setCloseHook(cb: (() => void) | null): void {
  onCloseHook = cb
}

export function openMainWindow(url: string): void {
  currentUrl = url
  if (main && !main.isDestroyed()) {
    void main.loadURL(url)
    return showMain()
  }
  main = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'MC Software',
    icon: assetPath('icon.ico'),
    webPreferences: webPrefs(),
  })
  // Keep a stable title instead of the page's <title>.
  main.on('page-title-updated', (e) => e.preventDefault())
  main.on('closed', () => {
    main = null
    onCloseHook?.()
  })
  main.webContents.on('did-fail-load', (_e, code, desc, failedUrl, isMainFrame) => {
    if (!isMainFrame || code === -3) return // -3 = aborted (navigation replaced)
    log(`load failed ${failedUrl}: ${desc} (${code})`)
    showOffline()
  })
  void main.loadURL(url)
}

function showOffline(): void {
  if (!main || main.isDestroyed()) return
  void main.loadFile(assetPath('offline.html'), { query: { url: currentUrl } })
}

export function retryMain(): void {
  if (main && !main.isDestroyed() && currentUrl) void main.loadURL(currentUrl)
}

export function showMain(): void {
  if (!main || main.isDestroyed()) return
  if (main.isMinimized()) main.restore()
  main.show()
  main.focus()
}

export const hasMainWindow = () => main !== null && !main.isDestroyed()

/** First-run / change-server window. Resolves when closed. */
export function openSetupWindow(): Promise<void> {
  return new Promise((resolve) => {
    if (setup && !setup.isDestroyed()) {
      setup.focus()
      return
    }
    setup = new BrowserWindow({
      width: 520,
      height: 560,
      resizable: false,
      title: 'MC Software - Configuración',
      icon: assetPath('icon.ico'),
      autoHideMenuBar: true,
      webPreferences: webPrefs(),
    })
    setup.removeMenu()
    setup.on('closed', () => {
      setup = null
      resolve()
    })
    void setup.loadFile(assetPath('setup.html'))
  })
}

export function closeSetupWindow(): void {
  if (setup && !setup.isDestroyed()) setup.close()
}

export function notify(message: string, detail?: string): void {
  void dialog.showMessageBox({ message, detail })
}
