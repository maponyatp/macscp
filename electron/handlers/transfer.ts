import { BrowserWindow, App, IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { TransferTask } from '../../src/types'
import { remoteDispatcher } from './remote'

export class TransferManager {
    private queue: TransferTask[] = []
    private activeTasks = 0
    private maxConcurrent = 3
    private win: BrowserWindow | null = null
    private app: App | null = null

    async setupHandlers(app: App, ipcMain: IpcMain) {
        this.app = app
        await this.loadQueue()

        ipcMain.handle('transfer:add', (_, task) => this.addTask(task))
        ipcMain.handle('transfer:get-queue', () => this.getQueue())
        ipcMain.handle('transfer:clear-completed', () => this.clearCompleted())
        ipcMain.handle('transfer:cancel', (_, id) => this.cancelTask(id))
        ipcMain.handle('transfer:retry-task', (_, id) => this.retryTask(id))
        ipcMain.handle('transfer:retry-all', () => this.retryAll())
    }

    setWindow(win: BrowserWindow) {
        this.win = win
    }

    private getQueuePath() {
        if (!this.app) return null
        return path.join(this.app.getPath('userData'), 'transfers.json')
    }

    private async loadQueue() {
        const queuePath = this.getQueuePath()
        if (!queuePath) return
        try {
            const data = await fs.readFile(queuePath, 'utf8')
            const savedQueue: TransferTask[] = JSON.parse(data)

            // On startup, mark interrupted tasks
            this.queue = savedQueue.map(task => {
                if (task.status === 'active' || task.status === 'pending') {
                    return { ...task, status: 'interrupted', speed: 0 }
                }
                return { ...task, speed: 0 }
            })
            this.emitQueue()

            // Auto-resume interrupted tasks on startup if any
            if (this.queue.some(t => t.status === 'interrupted')) {
                console.log('Resuming interrupted tasks...')
                this.processQueue()
            }
        } catch (err) {
            // Ignore if file doesn't exist
            this.queue = []
        }
    }

    private async saveQueue() {
        const queuePath = this.getQueuePath()
        if (!queuePath) return
        try {
            await fs.writeFile(queuePath, JSON.stringify(this.queue, null, 2))
        } catch (err) {
            console.error('Failed to save transfer queue:', err)
        }
    }

    addTask(task: Omit<TransferTask, 'id' | 'status' | 'progress' | 'transferredSize' | 'speed'>) {
        const newTask: TransferTask = {
            ...task,
            id: crypto.randomUUID(),
            status: 'pending',
            progress: 0,
            transferredSize: 0,
            speed: 0,
            retryCount: 0
        }
        this.queue.push(newTask)
        this.saveQueue()
        this.emitQueue()
        this.processQueue()
        return newTask.id
    }

    private emitQueue() {
        if (this.win) {
            this.win.webContents.send('transfer:queue-update', this.queue)
        }
    }

    private async processQueue() {
        if (this.activeTasks >= this.maxConcurrent) return

        const nextTask = this.queue.find(t => t.status === 'pending' || t.status === 'interrupted')
        if (!nextTask) return

        this.activeTasks++
        const oldStatus = nextTask.status
        nextTask.status = 'active'
        this.emitQueue()

        try {
            const startTime = Date.now()
            const startOffset = oldStatus === 'interrupted' ? nextTask.transferredSize : 0
            let lastTransferred = startOffset
            let lastTime = startTime

            const onProgress = (totalTransferred: number, _chunk: number, totalSize: number) => {
                const now = Date.now()
                const elapsed = now - lastTime

                nextTask.transferredSize = totalTransferred
                if (totalSize > 0) nextTask.totalSize = totalSize

                if (nextTask.totalSize) {
                    nextTask.progress = Math.round((totalTransferred / nextTask.totalSize) * 100)
                }

                if (elapsed > 500) {
                    const bytesSinceLast = totalTransferred - lastTransferred
                    nextTask.speed = (bytesSinceLast / elapsed) * 1000
                    lastTransferred = totalTransferred
                    lastTime = now
                    this.emitQueue()
                    this.saveQueue()
                }
            }

            if (nextTask.type === 'download') {
                await remoteDispatcher.getWithProgress(nextTask.remotePath, nextTask.localPath, onProgress, startOffset)
            } else {
                await remoteDispatcher.putWithProgress(nextTask.localPath, nextTask.remotePath, onProgress, startOffset)
            }

            nextTask.status = 'completed'
            nextTask.progress = 100
            nextTask.retryCount = 0
        } catch (err) {
            console.error('Transfer failed:', err)

            const maxRetries = 3
            nextTask.retryCount = (nextTask.retryCount || 0) + 1

            if (nextTask.retryCount <= maxRetries) {
                nextTask.status = 'pending' // Re-queue
                nextTask.error = `Retry ${nextTask.retryCount}/${maxRetries}: ${err instanceof Error ? err.message : String(err)}`
                console.log(`Auto-retrying task ${nextTask.id} (${nextTask.retryCount}/${maxRetries})`)
            } else {
                nextTask.status = 'failed'
                nextTask.error = err instanceof Error ? err.message : String(err)
            }
        } finally {
            this.activeTasks--
            this.saveQueue()
            this.emitQueue()
            this.processQueue()
        }
    }

    getQueue() {
        return this.queue
    }

    clearCompleted() {
        this.queue = this.queue.filter(t => t.status !== 'completed' && t.status !== 'failed' && t.status !== 'cancelled' && t.status !== 'interrupted')
        this.saveQueue()
        this.emitQueue()
    }

    cancelTask(id: string) {
        const task = this.queue.find(t => t.id === id)
        if (task) {
            task.status = 'cancelled'
            this.saveQueue()
            this.emitQueue()
        }
    }

    retryTask(id: string) {
        const task = this.queue.find(t => t.id === id)
        if (task && (task.status === 'failed' || task.status === 'cancelled' || task.status === 'interrupted')) {
            task.status = 'pending'
            task.error = undefined
            this.saveQueue()
            this.emitQueue()
            this.processQueue()
        }
    }

    retryAll() {
        this.queue.forEach(task => {
            if (task.status === 'failed' || task.status === 'cancelled' || task.status === 'interrupted') {
                task.status = 'pending'
                task.error = undefined
            }
        })
        this.saveQueue()
        this.emitQueue()
        this.processQueue()
    }
}

export const transferManager = new TransferManager()
