import * as ftp from "basic-ftp"
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { FileEntry, SSHProfile } from '../../src/types'


export class FTPHandler {
    private client: ftp.Client | null = null // For metadata (shared)
    private config: Partial<SSHProfile> | null = null

    private async getClient(signal?: AbortSignal): Promise<ftp.Client> {
        if (!this.config) throw new Error('Not connected')
        const client = new ftp.Client()

        const onAbort = () => {
            client.close()
        }
        if (signal?.aborted) {
            client.close()
            throw new Error('Aborted')
        }
        signal?.addEventListener('abort', onAbort)

        try {
            await client.access({
                host: this.config.host,
                port: this.config.port || 21,
                user: this.config.username,
                password: this.config.password,
                secure: this.config.protocol === 'ftps' || this.config.protocol === 'ftps-implicit',
                secureOptions: {
                    rejectUnauthorized: false
                }
            })
            return client
        } catch (err) {
            client.close()
            throw err
        } finally {
            signal?.removeEventListener('abort', onAbort)
        }
    }

    async connect(config: Partial<SSHProfile>): Promise<{ status: string }> {
        this.config = config
        if (this.client) {
            this.disconnect()
        }
        this.client = await this.getClient()
        return { status: 'connected' }
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

    async get(remotePath: string, localPath: string, signal?: AbortSignal) {
        const client = await this.getClient(signal)
        try {
            await client.downloadTo(localPath, remotePath)
            return true
        } finally {
            client.close()
        }
    }

    async getWithProgress(
        remotePath: string,
        localPath: string,
        onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void,
        offset: number = 0,
        signal?: AbortSignal
    ) {
        const client = await this.getClient(signal)
        let lastTransferred = 0
        client.trackProgress((info) => {
            const chunk = info.bytes - lastTransferred
            lastTransferred = info.bytes
            onProgress(info.bytes + offset, chunk, 0)
        })

        const onAbort = () => {
            client.close()
        }
        signal?.addEventListener('abort', onAbort)

        try {
            await client.downloadTo(localPath, remotePath, offset)
            return true
        } finally {
            signal?.removeEventListener('abort', onAbort)
            client.trackProgress()
            client.close()
        }
    }

    async put(localPath: string, remotePath: string, signal?: AbortSignal) {
        const client = await this.getClient(signal)
        try {
            await client.uploadFrom(localPath, remotePath)
            return true
        } finally {
            client.close()
        }
    }

    async putWithProgress(
        localPath: string,
        remotePath: string,
        onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void,
        offset: number = 0,
        signal?: AbortSignal
    ) {
        const client = await this.getClient(signal)
        let lastTransferred = 0
        client.trackProgress((info) => {
            const chunk = info.bytes - lastTransferred
            lastTransferred = info.bytes
            onProgress(info.bytes + offset, chunk, 0)
        })

        const onAbort = () => {
            client.close()
        }
        signal?.addEventListener('abort', onAbort)

        try {
            if (offset > 0) {
                await client.appendFrom(localPath, remotePath, { localStart: offset })
            } else {
                await client.uploadFrom(localPath, remotePath)
            }
            return true
        } finally {
            signal?.removeEventListener('abort', onAbort)
            client.trackProgress()
            client.close()
        }
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
        this.config = null
    }
}

export const ftpHandler = new FTPHandler()
