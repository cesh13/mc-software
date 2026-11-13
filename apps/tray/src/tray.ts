import { app, Menu, Tray, nativeImage } from 'electron'
import { assetPath, type Config } from './config'
import { getStatus } from './server-manager'
import { describeUpdate, getUpdateState } from './updater'

export interface TrayActions {
  open(): void
  checkUpdates(): void
  installUpdate(): void
  restartServer(): void
  changeMode(): void
  quit(): void
}

let tray: Tray | null = null
let cfgRef: Config
let actionsRef: TrayActions

const STATUS_TEXT = {
  stopped: 'Servidor detenido',
  starting: 'Iniciando servidor…',
  running: 'Servidor en ejecución',
  crashed: 'El servidor se detuvo; reintentando…',
} as const

export function createTray(cfg: Config, actions: TrayActions): void {
  cfgRef = cfg
  actionsRef = actions
  tray = new Tray(nativeImage.createFromPath(assetPath('icon.ico')))
  tray.on('double-click', actions.open)
  refreshTray()
}

export function refreshTray(): void {
  if (!tray) return
  const status = getStatus()
  const update = getUpdateState()
  const statusLine = `${STATUS_TEXT[status]} (puerto ${cfgRef.port})`
  tray.setToolTip(`MC Software - ${STATUS_TEXT[status]}`)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir', enabled: status === 'running', click: actionsRef.open },
      { type: 'separator' },
      { label: statusLine, enabled: false },
      { label: `Versión ${app.getVersion()}`, enabled: false },
      { label: describeUpdate(update), enabled: false },
      { type: 'separator' },
      ...(update.kind === 'ready'
        ? [{ label: 'Reiniciar para actualizar', click: actionsRef.installUpdate }]
        : []),
      { label: 'Buscar actualizaciones', click: actionsRef.checkUpdates },
      { label: 'Reiniciar servidor', click: actionsRef.restartServer },
      { label: 'Cambiar modo / servidor…', click: actionsRef.changeMode },
      { type: 'separator' },
      { label: 'Salir', click: actionsRef.quit },
    ]),
  )
}

export function balloon(title: string, content: string): void {
  tray?.displayBalloon({ title, content, iconType: 'info' })
}
