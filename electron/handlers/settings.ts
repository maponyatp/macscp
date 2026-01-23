import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import type { App, IpcMain } from 'electron'
import { encryptionManager } from './encryption'

let appInstance: App

// function to get paths lazily
function getPaths() {
    if (!appInstance) throw new Error('App not initialized')
    const userDataPath = appInstance.getPath('userData')
    return {
        userDataPath,
        profilesPath: path.join(userDataPath, 'profiles.json'),
        settingsPath: path.join(userDataPath, 'settings.json')
    }
}

export interface SSHProfile {
    id: string
    name: string
    host: string
    port: number
    username: string
    password?: string
    privateKeyPath?: string
    passphrase?: string
    folder?: string
    isFavorite?: boolean
    protocol?: 'sftp' | 'ftp' | 'ftps' | 's3'
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

const defaultSettings: AppSettings = {
    theme: 'system',
    showHiddenFiles: false,
    defaultLocalPath: os.homedir(),
    confirmOnDelete: true
}

async function getProfiles(): Promise<SSHProfile[]> {
    try {
        const { profilesPath } = getPaths()
        const data = await fs.readFile(profilesPath, 'utf-8')
        const profiles: SSHProfile[] = JSON.parse(data)

        // Decrypt sensitive fields if encryption is unlocked
        if (encryptionManager.isUnlocked()) {
            return profiles.map(p => ({
                ...p,
                password: p.password ? encryptionManager.decrypt(p.password) : undefined,
                passphrase: p.passphrase ? encryptionManager.decrypt(p.passphrase) : undefined,
                secretAccessKey: p.secretAccessKey ? encryptionManager.decrypt(p.secretAccessKey) : undefined
            }))
        }

        return profiles
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return []
        }
        throw error
    }
}

async function saveProfile(profile: SSHProfile) {
    const profiles = await getProfiles()

    // Encrypt sensitive fields before saving if encryption is unlocked
    const profileToSave = { ...profile }
    if (encryptionManager.isUnlocked()) {
        if (profileToSave.password) profileToSave.password = encryptionManager.encrypt(profileToSave.password)
        if (profileToSave.passphrase) profileToSave.passphrase = encryptionManager.encrypt(profileToSave.passphrase)
        if (profileToSave.secretAccessKey) profileToSave.secretAccessKey = encryptionManager.encrypt(profileToSave.secretAccessKey)
    }

    const index = profiles.findIndex(p => p.id === profile.id)

    if (index >= 0) {
        profiles[index] = profileToSave
    } else {
        profiles.push(profileToSave)
    }

    await fs.writeFile(getPaths().profilesPath, JSON.stringify(profiles, null, 2))
    return await getProfiles() // Return decrypted list if possible
}

async function deleteProfile(id: string) {
    let profiles = await getProfiles()
    profiles = profiles.filter(p => p.id !== id)
    await fs.writeFile(getPaths().profilesPath, JSON.stringify(profiles, null, 2))
    return profiles
}

async function getAppSettings(): Promise<AppSettings> {
    try {
        const { settingsPath } = getPaths()
        const data = await fs.readFile(settingsPath, 'utf-8')
        return { ...defaultSettings, ...JSON.parse(data) }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return defaultSettings
        }
        throw error
    }
}

async function saveAppSettings(settings: AppSettings) {
    await fs.writeFile(getPaths().settingsPath, JSON.stringify(settings, null, 2))
    return settings
}

export function setupSettingsHandlers(app: App, ipcMain: IpcMain) {
    appInstance = app
    ipcMain.handle('settings:list-profiles', async () => {
        return await getProfiles()
    })

    ipcMain.handle('settings:save-profile', async (_, profile: SSHProfile) => {
        return await saveProfile(profile)
    })

    ipcMain.handle('settings:delete-profile', async (_, id: string) => {
        return await deleteProfile(id)
    })

    ipcMain.handle('settings:get-app-settings', async () => {
        return await getAppSettings()
    })

    ipcMain.handle('settings:save-app-settings', async (_, settings: AppSettings) => {
        return await saveAppSettings(settings)
    })
}
