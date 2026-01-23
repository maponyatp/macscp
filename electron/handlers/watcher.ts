import * as chokidar from 'chokidar'
import type { IpcMain } from 'electron'
import { transferManager } from './transfer'
import path from 'node:path'
import fs from 'node:fs'

class FileWatcher {
    private watchers: Map<string, chokidar.FSWatcher> = new Map()

    setupHandlers(ipcMain: IpcMain) {
        ipcMain.handle('watcher:start', (_, { localPath, remotePath }) => {
            this.startWatching(localPath, remotePath)
            return true
        })

        ipcMain.handle('watcher:stop', (_, localPath: string) => {
            this.stopWatching(localPath)
            return true
        })

        ipcMain.handle('watcher:active', (_, localPath: string) => {
            return this.watchers.has(localPath)
        })
    }

    private startWatching(localPath: string, remotePath: string) {
        if (this.watchers.has(localPath)) return

        console.log(`Starting watch on ${localPath} for ${remotePath}`)

        const watcher = chokidar.watch(localPath, {
            ignored: /(^|[/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        })

        watcher.on('add', (filePath) => {
            this.queueUpload(localPath, filePath, remotePath)
        }).on('change', (filePath) => {
            this.queueUpload(localPath, filePath, remotePath)
        })

        this.watchers.set(localPath, watcher)
    }

    private stopWatching(localPath: string) {
        const watcher = this.watchers.get(localPath)
        if (watcher) {
            watcher.close()
            this.watchers.delete(localPath)
            console.log(`Stopped watch on ${localPath}`)
        }
    }

    private queueUpload(baseLocalPath: string, filePath: string, baseRemotePath: string) {
        const relativePath = path.relative(baseLocalPath, filePath)
        const remoteFilePath = path.posix.join(baseRemotePath, relativePath)

        console.log(`Auto-queuing upload: ${filePath} -> ${remoteFilePath}`)

        try {
            const stats = fs.statSync(filePath)
            transferManager.addTask({
                type: 'upload',
                localPath: filePath,
                remotePath: remoteFilePath,
                fileName: path.basename(filePath),
                totalSize: stats.size
            })
        } catch (err) {
            console.error('Failed to stat file for auto-upload:', err)
        }
    }
}

export const fileWatcher = new FileWatcher()
