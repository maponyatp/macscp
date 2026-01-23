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
            remoteConnect: (config: Partial<SSHProfile>) => Promise<{ status: string }>
            remoteList: (path: string) => Promise<FileEntry[]>
            remoteDisconnect: () => Promise<void>
            remoteGet: (remotePath: string, localPath: string) => Promise<boolean>
            remotePut: (localPath: string, remotePath: string) => Promise<boolean>
            remoteShellStart: (rows: number, cols: number) => Promise<boolean>
            remoteShellWrite: (data: string) => Promise<void>
            remoteShellResize: (rows: number, cols: number) => Promise<void>
            remoteStartDrag: (remotePath: string) => void
            onShellData: (callback: (data: string) => void) => () => void
            remoteReadFile: (remotePath: string) => Promise<string>
            remoteWriteFile: (remotePath: string, content: string) => Promise<void>
            remoteEditExternal: (remotePath: string) => Promise<{ localPath: string }>
            onRemoteEditStatus: (callback: (data: { path: string, status: string, error?: string }) => void) => () => void
            settingsListProfiles: () => Promise<SSHProfile[]>
            settingsSaveProfile: (profile: SSHProfile) => Promise<SSHProfile[]>
            settingsDeleteProfile: (id: string) => Promise<SSHProfile[]>
            settingsGetAppSettings: () => Promise<AppSettings>
            settingsSaveAppSettings: (settings: AppSettings) => Promise<AppSettings>
            dialogSelectFile: () => Promise<string | null>
            transferAdd: (task: Omit<import('./types').TransferTask, 'id' | 'status' | 'progress' | 'transferredSize' | 'speed'>) => Promise<string>
            transferGetQueue: () => Promise<import('./types').TransferTask[]>
            transferClearCompleted: () => Promise<void>
            transferCancel: (id: string) => Promise<void>
            transferRetryTask: (id: string) => Promise<void>
            transferRetryAll: () => Promise<void>
            onTransferQueueUpdate: (callback: (queue: import('./types').TransferTask[]) => void) => () => void
            syncCompare: (localDir: string, remoteDir: string) => Promise<SyncDiff[]>
            watcherStart: (localPath: string, remotePath: string) => Promise<boolean>
            watcherStop: (localPath: string) => Promise<boolean>
            watcherActive: (localPath: string) => Promise<boolean>
            encryptionSet: (password: string) => Promise<boolean>
            encryptionClear: () => Promise<boolean>
            encryptionUnlocked: () => Promise<boolean>
        }
    }
}

export interface SyncDiff {
    name: string
    localPath: string
    remotePath: string
    status: 'only-local' | 'only-remote' | 'newer-local' | 'newer-remote' | 'same'
    localSize?: number
    remoteSize?: number
    localMtime?: Date
    remoteMtime?: Date
}
