export interface FileEntry {
    name: string
    isDirectory: boolean
    size: number
    updatedAt: Date
}

export interface SSHProfile {
    id: string
    name: string
    host?: string
    port?: number
    username?: string
    password?: string
    privateKeyPath?: string
    passphrase?: string
    folder?: string
    isFavorite?: boolean
    useAgent?: boolean
    protocol?: 'sftp' | 'ftp' | 'ftps' | 'ftps-implicit' | 's3'
    accessKeyId?: string
    secretAccessKey?: string
    region?: string
    bucket?: string
    endpoint?: string
}

export interface AppSettings {
    theme: 'system' | 'dark' | 'light'
    showHiddenFiles: boolean
    defaultLocalPath: string
    confirmOnDelete: boolean
}

export interface TransferTask {
    id: string
    type: 'upload' | 'download'
    localPath: string
    remotePath: string
    fileName: string
    status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled' | 'interrupted'
    progress: number // 0-100
    totalSize: number
    transferredSize: number
    speed: number // bytes per second
    error?: string
}

export const defaultSettings: AppSettings = {
    theme: 'system',
    showHiddenFiles: false,
    defaultLocalPath: '/', // Will be updated by main process
    confirmOnDelete: true
}
