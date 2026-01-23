
export interface SSHProfile {
    id: string
    name: string
    host: string
    port: number
    username: string
    password?: string
    privateKeyPath?: string
}

export interface AppSettings {
    theme: 'system' | 'dark' | 'light'
    showHiddenFiles: boolean
    defaultLocalPath: string
    confirmOnDelete: boolean
}

export const defaultSettings: AppSettings = {
    theme: 'system',
    showHiddenFiles: false,
    defaultLocalPath: '/', // Will be updated by main process
    confirmOnDelete: true
}
