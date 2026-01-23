import { TransferTask } from '../src/types'
import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
console.log('Preload script loaded successfully')
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

contextBridge.exposeInMainWorld('api', {
  localList: (path: string) => ipcRenderer.invoke('local:list', path),
  remoteConnect: (config: unknown) => ipcRenderer.invoke('remote:connect', config),
  remoteList: (path: string) => ipcRenderer.invoke('remote:list', path),
  remoteDisconnect: () => ipcRenderer.invoke('remote:disconnect'),
  remoteGet: (remotePath: string, localPath: string) => ipcRenderer.invoke('remote:get', { remotePath, localPath }),
  remotePut: (localPath: string, remotePath: string) => ipcRenderer.invoke('remote:put', { localPath, remotePath }),
  remoteShellStart: (rows: number, cols: number) => ipcRenderer.invoke('remote:shell-start', { rows, cols }),
  remoteShellWrite: (data: string) => ipcRenderer.invoke('remote:shell-write', data),
  remoteShellResize: (rows: number, cols: number) => ipcRenderer.invoke('remote:shell-resize', { rows, cols }),
  remoteStartDrag: (remotePath: string) => ipcRenderer.send('remote:start-drag', remotePath),
  onShellData: (callback: (data: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: string) => callback(data)
    ipcRenderer.on('remote:shell-data', listener)
    return () => ipcRenderer.off('remote:shell-data', listener)
  },
  remoteReadFile: (remotePath: string) => ipcRenderer.invoke('remote:read-file', remotePath),
  remoteWriteFile: (remotePath: string, content: string) => ipcRenderer.invoke('remote:write-file', { remotePath, content }),
  remoteEditExternal: (remotePath: string) => ipcRenderer.invoke('remote:edit-external', remotePath),
  onRemoteEditStatus: (callback: (data: { path: string, status: string, error?: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { path: string, status: string, error?: string }) => callback(data)
    ipcRenderer.on('remote:edit-status', listener)
    return () => ipcRenderer.off('remote:edit-status', listener)
  },
  settingsListProfiles: () => ipcRenderer.invoke('settings:list-profiles'),
  settingsSaveProfile: (profile: unknown) => ipcRenderer.invoke('settings:save-profile', profile),
  settingsDeleteProfile: (id: string) => ipcRenderer.invoke('settings:delete-profile', id),
  settingsGetAppSettings: () => ipcRenderer.invoke('settings:get-app-settings'),
  settingsSaveAppSettings: (settings: unknown) => ipcRenderer.invoke('settings:save-app-settings', settings),
  dialogSelectFile: () => ipcRenderer.invoke('dialog:open-file'),

  // Transfer Manager
  transferAdd: (task: { type: 'upload' | 'download', localPath: string, remotePath: string, fileName: string, totalSize: number }) => ipcRenderer.invoke('transfer:add', task),
  transferGetQueue: () => ipcRenderer.invoke('transfer:get-queue'),
  transferClearCompleted: () => ipcRenderer.invoke('transfer:clear-completed'),
  transferCancel: (id: string) => ipcRenderer.invoke('transfer:cancel', id),
  transferRetryTask: (id: string) => ipcRenderer.invoke('transfer:retry-task', id),
  transferRetryAll: () => ipcRenderer.invoke('transfer:retry-all'),
  onTransferQueueUpdate: (callback: (queue: TransferTask[]) => void) => {
    const listener = (_: Electron.IpcRendererEvent, queue: TransferTask[]) => callback(queue)
    ipcRenderer.on('transfer:queue-update', listener)
    return () => ipcRenderer.off('transfer:queue-update', listener)
  },
  syncCompare: (localDir: string, remoteDir: string) => ipcRenderer.invoke('sync:compare', { localDir, remoteDir }),
  watcherStart: (localPath: string, remotePath: string) => ipcRenderer.invoke('watcher:start', { localPath, remotePath }),
  watcherStop: (localPath: string) => ipcRenderer.invoke('watcher:stop', localPath),
  watcherActive: (localPath: string) => ipcRenderer.invoke('watcher:active', localPath),
  encryptionSet: (password: string) => ipcRenderer.invoke('encryption:set', password),
  encryptionClear: () => ipcRenderer.invoke('encryption:clear'),
  encryptionUnlocked: () => ipcRenderer.invoke('encryption:unlocked'),
})
