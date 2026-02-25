import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { sshHandler } from './ssh'
import { ftpHandler } from './ftp'
import { s3Handler } from './s3'
import { SSHProfile, FileEntry } from '../../src/types'
export type { SSHProfile, FileEntry }

export class RemoteDispatcher {
    private activeProtocol: 'sftp' | 'ftp' | 'ftps' | 'ftps-implicit' | 's3' | null = null

    get handler() {
        if (this.activeProtocol === 'sftp') return sshHandler
        if (this.activeProtocol === 'ftp' || this.activeProtocol === 'ftps') return ftpHandler
        if (this.activeProtocol === 's3') return s3Handler
        throw new Error('No active remote connection')
    }

    async connect(config: Partial<SSHProfile>) {
        // Disconnect existing if different protocol? 
        // Or just always disconnect for simplicity.
        this.disconnect()

        const protocol = config.protocol || 'sftp'
        this.activeProtocol = protocol

        if (protocol === 'sftp') {
            return sshHandler.connect(config)
        } else if (protocol === 's3') {
            return s3Handler.connect(config)
        } else {
            return ftpHandler.connect(config)
        }
    }

    async list(path: string): Promise<FileEntry[]> {
        return this.handler.list(path)
    }

    async get(remotePath: string, localPath: string, signal?: AbortSignal) {
        return this.handler.get(remotePath, localPath, signal)
    }

    async put(localPath: string, remotePath: string, signal?: AbortSignal) {
        return this.handler.put(localPath, remotePath, signal)
    }

    async stat(remotePath: string) {
        return this.handler.stat(remotePath)
    }

    async readFile(remotePath: string) {
        return this.handler.readFile(remotePath)
    }

    async readBuffer(remotePath: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (this.handler as any).readBuffer !== 'function') {
            throw new Error(`Buffer reading is not supported for ${this.activeProtocol}`)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this.handler as any).readBuffer(remotePath)
    }

    async writeFile(remotePath: string, content: string) {
        return this.handler.writeFile(remotePath, content)
    }

    async execCommand(command: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (this.handler as any).execCommand !== 'function') {
            throw new Error(`Command execution is not supported for ${this.activeProtocol}`)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this.handler as any).execCommand(command)
    }

    async getWithProgress(remotePath: string, localPath: string, onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void, offset?: number, signal?: AbortSignal) {
        return this.handler.getWithProgress(remotePath, localPath, onProgress, offset, signal)
    }

    async putWithProgress(localPath: string, remotePath: string, onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void, offset?: number, signal?: AbortSignal) {
        return this.handler.putWithProgress(localPath, remotePath, onProgress, offset, signal)
    }

    async startDrag(remotePath: string): Promise<string> {
        const fileName = path.basename(remotePath)
        const tempDir = path.join(os.tmpdir(), 'macscp-drag-' + Date.now())
        await fs.mkdir(tempDir, { recursive: true })
        const tempPath = path.join(tempDir, fileName)

        // Use the handler to download the file to the temp path
        await this.handler.get(remotePath, tempPath)
        return tempPath
    }

    disconnect() {
        sshHandler.disconnect()
        ftpHandler.disconnect()
        s3Handler.disconnect()
        this.activeProtocol = null
    }

    getActiveProtocol() {
        return this.activeProtocol
    }
}

export const remoteDispatcher = new RemoteDispatcher()
