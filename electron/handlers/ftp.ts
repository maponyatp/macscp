import * as ftp from "basic-ftp"
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { FileEntry, SSHProfile } from '../../src/types'


export class FTPHandler {
    private client: ftp.Client | null = null

    async connect(config: Partial<SSHProfile>) {
        if (this.client) {
            this.disconnect()
        }

        this.client = new ftp.Client()
        // this.client.ftp.log = console.log // Debugging

        try {
            await this.client.access({
                host: config.host,
                port: config.port || 21,
                user: config.username,
                password: config.password,
                secure: config.protocol === 'ftps' || config.protocol === 'ftps-implicit',
                secureOptions: {
                    rejectUnauthorized: false
                }
            })
            return { status: 'connected' }
        } catch (err) {
            this.client = null
            throw err
        }
    }

    async list(remotePath: string): Promise<FileEntry[]> {
        if (!this.client) throw new Error('Not connected')
        const list = await this.client.list(remotePath)
        return list.map(item => ({
            name: item.name,
            isDirectory: item.isDirectory,
            size: item.size,
            updatedAt: item.modifiedAt ? new Date(item.modifiedAt) : new Date()
        }))
    }

    async stat(remotePath: string) {
        if (!this.client) throw new Error('Not connected')
        const list = await this.client.list(path.posix.dirname(remotePath))
        const entry = list.find(item => item.name === path.posix.basename(remotePath))
        if (!entry || !entry.modifiedAt) throw new Error('File not found')
        return {
            size: entry.size,
            mtime: new Date(entry.modifiedAt).getTime() / 1000,
            mode: entry.isDirectory ? 0o40000 : 0o100000
        }
    }

    async get(remotePath: string, localPath: string) {
        if (!this.client) throw new Error('Not connected')
        await this.client.downloadTo(localPath, remotePath)
        return true
    }

    async getWithProgress(remotePath: string, localPath: string, onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void, offset: number = 0) {
        if (!this.client) throw new Error('Not connected')

        let lastTransferred = 0
        this.client.trackProgress(info => {
            const chunk = info.bytes - lastTransferred
            lastTransferred = info.bytes
            onProgress(info.bytes + offset, chunk, 0)
        })

        try {
            await this.client.downloadTo(localPath, remotePath, offset)
        } finally {
            this.client.trackProgress()
        }
        return true
    }

    async put(localPath: string, remotePath: string) {
        if (!this.client) throw new Error('Not connected')
        await this.client.uploadFrom(localPath, remotePath)
        return true
    }

    async putWithProgress(localPath: string, remotePath: string, onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void, offset: number = 0) {
        if (!this.client) throw new Error('Not connected')

        let lastTransferred = 0
        this.client.trackProgress(info => {
            const chunk = info.bytes - lastTransferred
            lastTransferred = info.bytes
            onProgress(info.bytes + offset, chunk, 0)
        })

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await this.client.uploadFrom(localPath, remotePath, { remoteStartPos: offset } as any)
        } finally {
            this.client.trackProgress()
        }
        return true
    }

    async readFile(remotePath: string): Promise<string> {
        if (!this.client) throw new Error('Not connected')
        const tempPath = path.join(process.env.APP_ROOT || "", 'temp_ftp_read')
        await this.client.downloadTo(tempPath, remotePath)
        const content = await fs.readFile(tempPath, 'utf8')
        await fs.unlink(tempPath)
        return content
    }

    async writeFile(remotePath: string, content: string): Promise<boolean> {
        if (!this.client) throw new Error('Not connected')
        const buffer = Buffer.from(content, 'utf8')
        const stream = Readable.from(buffer)
        await this.client.uploadFrom(stream, remotePath)
        return true
    }

    disconnect() {
        if (this.client) {
            this.client.close()
            this.client = null
        }
    }
}

export const ftpHandler = new FTPHandler()
