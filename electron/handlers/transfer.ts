import { BrowserWindow, App, IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { TransferTask } from '../../src/types'
import { remoteDispatcher } from './remote'

export class TransferManager {
    private queue: TransferTask[] = []
    private activeTasks = 0
    private maxConcurrent = 3
    private activeControllers = new Map<string, AbortController>()
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

    /**
     * Adds a new task to the transfer queue.
     * MacSCP follows a "Forced Overwrite" policy: any existing files at the destination
     * will be overwritten without prompting the user, as per core design.
     */
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

        // Spawn multiple tasks up to the limit
        while (this.activeTasks < this.maxConcurrent) {
            const nextTask = this.queue.find(t => t.status === 'pending' || t.status === 'interrupted')
            if (!nextTask) break

            this.runTask(nextTask)
        }
    }

    private async runTask(task: TransferTask) {
        this.activeTasks++
        const oldStatus = task.status
        task.status = 'active'
        this.emitQueue()

        try {
            const startTime = Date.now()
            const startOffset = oldStatus === 'interrupted' ? task.transferredSize : 0
            let lastTransferred = startOffset
            let lastTime = startTime

            const onProgress = (totalTransferred: number, _chunk: number, totalSize: number) => {
                const now = Date.now()
                const elapsed = now - lastTime

                task.transferredSize = totalTransferred
                if (totalSize > 0) task.totalSize = totalSize

                if (task.totalSize) {
                    task.progress = Math.round((totalTransferred / task.totalSize) * 100)
                }

                if (elapsed > 500) {
                    const bytesSinceLast = totalTransferred - lastTransferred
                    task.speed = (bytesSinceLast / elapsed) * 1000
                    lastTransferred = totalTransferred
                    lastTime = now
                    this.emitQueue()
                    this.saveQueue()
                }
            }

            const controller = new AbortController()
            this.activeControllers.set(task.id, controller)

            if (task.type === 'download') {
                await remoteDispatcher.getWithProgress(task.remotePath, task.localPath, onProgress, startOffset, controller.signal)
            } else {
                await remoteDispatcher.putWithProgress(task.localPath, task.remotePath, onProgress, startOffset, controller.signal)
            }

            task.status = 'completed'
            task.progress = 100
            task.retryCount = 0
            task.speed = 0
        } catch (err) {
            console.error(`Transfer failed for task ${task.id}:`, err)

            const maxRetries = 3
            task.retryCount = (task.retryCount || 0) + 1

            if (task.retryCount <= maxRetries) {
                task.status = 'pending' // Re-queue
                task.error = `Retry ${task.retryCount}/${maxRetries}: ${err instanceof Error ? err.message : String(err)}`
                console.log(`Auto-retrying task ${task.id} (${task.retryCount}/${maxRetries})`)
            } else {
                task.status = 'failed'
                task.error = err instanceof Error ? err.message : String(err)
                task.speed = 0
            }
        } finally {
            this.activeControllers.delete(task.id)
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
            const controller = this.activeControllers.get(id)
            if (controller) {
                controller.abort()
                this.activeControllers.delete(id)
            }
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
