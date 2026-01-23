/// <reference types="vite/client" />

import { SSHProfile, AppSettings } from './types'

// Duplicate FileEntry definition or move to shared types if possible.
// For now, defining it here to avoid import issues in d.ts if not set up for module augmentation properly.
interface FileEntry {
    name: string
    isDirectory: boolean
    size: number
    updatedAt: Date
}

declare global {
    interface Window {
        ipcRenderer: import('electron').IpcRenderer
        api: {
            localList: (path?: string) => Promise<FileEntry[]>
            sshConnect: (config: Omit<SSHProfile, 'id' | 'name'>) => Promise<{ status: string }>
            sshList: (path: string) => Promise<FileEntry[]>
            sshDisconnect: () => Promise<void>
            sshGet: (remotePath: string, localPath: string) => Promise<boolean>
            sshPut: (localPath: string, remotePath: string) => Promise<boolean>
            sshShellStart: (rows: number, cols: number) => Promise<boolean>
            sshShellWrite: (data: string) => Promise<void>
            sshShellResize: (rows: number, cols: number) => Promise<void>
            onShellData: (callback: (data: string) => void) => () => void
            sshReadFile: (remotePath: string) => Promise<string>
            sshWriteFile: (remotePath: string, content: string) => Promise<void>
            settingsListProfiles: () => Promise<SSHProfile[]>
            settingsSaveProfile: (profile: SSHProfile) => Promise<SSHProfile[]>
            settingsDeleteProfile: (id: string) => Promise<SSHProfile[]>
            settingsGetAppSettings: () => Promise<AppSettings>
            settingsSaveAppSettings: (settings: AppSettings) => Promise<AppSettings>
        }
    }
}
