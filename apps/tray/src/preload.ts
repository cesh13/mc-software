import { contextBridge, ipcRenderer } from 'electron'

// Minimal bridge for the local setup / offline pages only.
contextBridge.exposeInMainWorld('mc', {
  info: (): Promise<{ host: string; port: number; mode: string | null; version: string }> =>
    ipcRenderer.invoke('mc:info'),
  testConnection: (host: string, port: number): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('mc:test', host, port),
  saveServer: (): Promise<void> => ipcRenderer.invoke('mc:save', { mode: 'server' }),
  saveClient: (host: string, port: number): Promise<void> =>
    ipcRenderer.invoke('mc:save', { mode: 'client', host, port }),
  retry: (): Promise<void> => ipcRenderer.invoke('mc:retry'),
  changeServer: (): Promise<void> => ipcRenderer.invoke('mc:change'),
  cancel: (): Promise<void> => ipcRenderer.invoke('mc:cancel'),
})
