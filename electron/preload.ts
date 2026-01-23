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
  sshConnect: (config: unknown) => ipcRenderer.invoke('ssh:connect', config),
  sshList: (path: string) => ipcRenderer.invoke('ssh:list', path),
  sshDisconnect: () => ipcRenderer.invoke('ssh:disconnect'),
  sshGet: (remotePath: string, localPath: string) => ipcRenderer.invoke('ssh:get', { remotePath, localPath }),
  sshPut: (localPath: string, remotePath: string) => ipcRenderer.invoke('ssh:put', { localPath, remotePath }),
  sshShellStart: (rows: number, cols: number) => ipcRenderer.invoke('ssh:shell-start', { rows, cols }),
  sshShellWrite: (data: string) => ipcRenderer.invoke('ssh:shell-write', data),
  sshShellResize: (rows: number, cols: number) => ipcRenderer.invoke('ssh:shell-resize', { rows, cols }),
  onShellData: (callback: (data: string) => void) => {
    const listener = (_: any, data: string) => callback(data)
    ipcRenderer.on('ssh:shell-data', listener)
    return () => ipcRenderer.off('ssh:shell-data', listener)
  },
  sshReadFile: (remotePath: string) => ipcRenderer.invoke('ssh:read-file', remotePath),
  sshWriteFile: (remotePath: string, content: string) => ipcRenderer.invoke('ssh:write-file', { remotePath, content }),
  settingsListProfiles: () => ipcRenderer.invoke('settings:list-profiles'),
  settingsSaveProfile: (profile: unknown) => ipcRenderer.invoke('settings:save-profile', profile),
  settingsDeleteProfile: (id: string) => ipcRenderer.invoke('settings:delete-profile', id),
  settingsGetAppSettings: () => ipcRenderer.invoke('settings:get-app-settings'),
  settingsSaveAppSettings: (settings: unknown) => ipcRenderer.invoke('settings:save-app-settings', settings),
})
