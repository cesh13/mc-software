import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'

let serverProcess: ChildProcess | null = null
let restarting = false

function getApiPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'api', 'index.js')
  }
  // Dev: resolve relative to the monorepo root
  return path.join(app.getAppPath(), '..', 'api', 'src', 'index.ts')
}

function getDataDir(): string {
  return app.getPath('userData')
}

function getModulesDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'modules')
  }
  return path.join(app.getAppPath(), '..', '..', 'modules')
}

export function startServer(onReady?: () => void, onCrash?: () => void): void {
  const apiPath = getApiPath()
  const cmd = app.isPackaged ? 'node' : 'tsx'
  const args = [apiPath]

  serverProcess = spawn(cmd, args, {
    env: {
      ...process.env,
      ACCOUNTING_DATA_DIR: getDataDir(),
      ACCOUNTING_MODULES_DIR: getModulesDir(),
      ACCOUNTING_UI_DIR: app.isPackaged
        ? path.join(process.resourcesPath, 'ui')
        : undefined,
    },
    stdio: 'pipe',
  })

  serverProcess.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString()
    if (msg.includes('running on') && onReady) onReady()
  })

  serverProcess.on('exit', (code) => {
    if (restarting) return
    console.log(`Server exited with code ${code} — restarting…`)
    onCrash?.()
    setTimeout(() => startServer(onReady, onCrash), 2000)
  })
}

export function stopServer(): Promise<void> {
  restarting = true
  return new Promise((resolve) => {
    if (!serverProcess) { resolve(); return }
    serverProcess.once('exit', () => resolve())
    serverProcess.kill()
  })
}

export function restartServer(onReady?: () => void): void {
  stopServer().then(() => {
    restarting = false
    startServer(onReady)
  })
}

export function isRunning(): boolean {
  return serverProcess !== null && !serverProcess.killed
}
