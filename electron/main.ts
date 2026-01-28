import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron') as typeof import('electron')

import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { watch } from 'node:fs'
import path from 'node:path'
import { remoteDispatcher } from './handlers/remote'
import { sshHandler } from './handlers/ssh'
import { handleLocalList } from './handlers/local'
import { setupSettingsHandlers } from './handlers/settings'
import { transferManager } from './handlers/transfer'
import { syncEngine } from './handlers/sync'
import { fileWatcher } from './handlers/watcher'
import { encryptionManager } from './handlers/encryption'
import type { SSHProfile } from '../src/types'

const editorWatchers = new Map<string, import('node:fs').FSWatcher>()

// Global Error Handlers for Stability
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

async function cleanupTempDrags(app: Electron.App) {
  const tempRoot = app.getPath('temp')
  try {
    const files = await fs.readdir(tempRoot)
    for (const file of files) {
      if (file.startsWith('macscp-drag-') || file.startsWith('macscp-edit')) {
        const fullPath = path.join(tempRoot, file)
        try {
          await fs.rm(fullPath, { recursive: true, force: true })
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    }
  } catch (err: unknown) {
    console.error('Failed to cleanup temp directories:', err)
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'parent') : RENDERER_DIST

let win: InstanceType<typeof BrowserWindow> | null

function createWindow() {
  win = new BrowserWindow({
    title: 'MacSCP',
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    trafficLightPosition: { x: 15, y: 15 },
    icon: path.join(process.env.VITE_PUBLIC, 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    // win.webContents.openDevTools()
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  transferManager.setWindow(win)
}

function setupIpcHandlers() {
  ipcMain.handle('local:list', handleLocalList)
  ipcMain.handle('remote:connect', (_: Electron.IpcMainInvokeEvent, config: Partial<SSHProfile>) => remoteDispatcher.connect(config))
  ipcMain.handle('remote:list', (_: Electron.IpcMainInvokeEvent, path: string) => remoteDispatcher.list(path))
  ipcMain.handle('remote:disconnect', () => remoteDispatcher.disconnect())
  ipcMain.handle('remote:get', (_: Electron.IpcMainInvokeEvent, { remotePath, localPath }: { remotePath: string, localPath: string }) => remoteDispatcher.get(remotePath, localPath))
  ipcMain.handle('remote:put', (_: Electron.IpcMainInvokeEvent, { localPath, remotePath }: { localPath: string, remotePath: string }) => remoteDispatcher.put(localPath, remotePath))
  ipcMain.handle('remote:shell-start', (event: Electron.IpcMainInvokeEvent, { rows, cols }: { rows: number, cols: number }) => {
    if (remoteDispatcher.getActiveProtocol() !== 'sftp') {
      throw new Error('Terminal only supported for SFTP')
    }
    return sshHandler.spawnShell(rows, cols, (data) => {
      event.sender.send('remote:shell-data', data)
    })
  })
  ipcMain.handle('remote:shell-write', (_: Electron.IpcMainInvokeEvent, data: string) => sshHandler.writeShell(data))
  ipcMain.handle('remote:shell-resize', (_: Electron.IpcMainInvokeEvent, { rows, cols }: { rows: number, cols: number }) => sshHandler.resizeShell(rows, cols))
  ipcMain.handle('remote:read-file', (_: Electron.IpcMainInvokeEvent, remotePath: string) => remoteDispatcher.readFile(remotePath))
  ipcMain.handle('remote:write-file', (_: Electron.IpcMainInvokeEvent, { remotePath, content }: { remotePath: string, content: string }) => remoteDispatcher.writeFile(remotePath, content))

  ipcMain.handle('remote:edit-external', async (event: Electron.IpcMainInvokeEvent, remotePath: string) => {
    const fileName = path.basename(remotePath)
    const tempDir = path.join(app.getPath('temp'), 'macscp-edit')
    await fs.mkdir(tempDir, { recursive: true })
    const localPath = path.join(tempDir, fileName)

    // 1. Download content
    const content = await remoteDispatcher.readFile(remotePath)
    await fs.writeFile(localPath, content)

    // 2. Open in external app
    await shell.openPath(localPath)

    // 3. Watch for changes
    if (editorWatchers.has(localPath)) {
      editorWatchers.get(localPath)?.close()
    }

    let isUploading = false
    const watcher = watch(localPath, async (eventType) => {
      if (eventType === 'change' && !isUploading) {
        isUploading = true
        try {
          // Debounce slightly to ensure file handle is released
          await new Promise(resolve => setTimeout(resolve, 100))
          const newContent = await fs.readFile(localPath, 'utf8')
          await remoteDispatcher.writeFile(remotePath, newContent)
          event.sender.send('remote:edit-status', { path: remotePath, status: 'uploaded' })
        } catch (err) {
          event.sender.send('remote:edit-status', { path: remotePath, status: 'error', error: String(err) })
        } finally {
          isUploading = false
        }
      }
    })

    editorWatchers.set(localPath, watcher)

    return { localPath }
  })

  ipcMain.handle('remote:start-drag', async (event: Electron.IpcMainInvokeEvent, remotePath: string) => {
    try {
      const localPath = await remoteDispatcher.startDrag(remotePath)
      // Use a more appropriate icon if available, or just generic file icon
      // Note: drag requires a valid file path for the icon
      event.sender.startDrag({
        file: localPath,
        icon: path.join(process.env.VITE_PUBLIC, 'file-icon.png')
      })
    } catch (err) {
      console.error('Failed to start native drag:', err)
    }
  })

  ipcMain.handle('dialog:open-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'SSH Keys', extensions: ['key', 'pem', 'id_rsa', 'id_ed25519'] }
      ]
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // Transfer Handlers are setup in TransferManager
  transferManager.setupHandlers(app, ipcMain)

  ipcMain.handle('sync:compare', (_: Electron.IpcMainInvokeEvent, { localDir, remoteDir }: { localDir: string, remoteDir: string }) => syncEngine.compare(localDir, remoteDir))

  fileWatcher.setupHandlers(ipcMain)

  ipcMain.handle('encryption:set', async (_: Electron.IpcMainInvokeEvent, password: string) => {
    await encryptionManager.setMasterPassword(password)
    return true
  })
  ipcMain.handle('encryption:clear', () => {
    encryptionManager.clear()
    return true
  })
  ipcMain.handle('encryption:unlocked', () => {
    return encryptionManager.isUnlocked()
  })

  setupSettingsHandlers(app, ipcMain)
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  try {
    await cleanupTempDrags(app)
    setupIpcHandlers()
    createWindow()
  } catch (err) {
    console.error('Failed to start application:', err)
  }
})
