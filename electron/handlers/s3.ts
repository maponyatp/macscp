import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import fs from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { FileEntry, SSHProfile } from '../../src/types'


export class S3Handler {
    private client: S3Client | null = null
    private bucket: string | null = null

    async connect(config: Partial<SSHProfile>) {
        this.bucket = config.bucket || null
        this.client = new S3Client({
            region: config.region || 'us-east-1',
            credentials: {
                accessKeyId: config.accessKeyId || '',
                secretAccessKey: config.secretAccessKey || ''
            },
            endpoint: config.endpoint || undefined,
            forcePathStyle: !!config.endpoint // Often needed for non-AWS S3
        })

        // Test connection by listing or head (simple check)
        try {
            await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket!, MaxKeys: 1 }))
            return { status: 'connected' }
        } catch (err) {
            this.client = null
            throw err
        }
    }

    async list(remotePath: string): Promise<FileEntry[]> {
        if (!this.client || !this.bucket) throw new Error('Not connected')

        // Normalize path for S3 (no leading slash, must end with slash if dir)
        let prefix = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath
        if (prefix && !prefix.endsWith('/')) prefix += '/'
        if (prefix === '/') prefix = ''

        const command = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            Delimiter: '/'
        })

        const response = await this.client.send(command)
        const entries: FileEntry[] = []

        // Common Prefixes are "directories"
        if (response.CommonPrefixes) {
            for (const cp of response.CommonPrefixes) {
                if (!cp.Prefix) continue
                const name = cp.Prefix.slice(prefix.length).replace(/\/$/, '')
                if (!name) continue
                entries.push({
                    name,
                    isDirectory: true,
                    size: 0,
                    updatedAt: new Date()
                })
            }
        }

        // Contents are "files"
        if (response.Contents) {
            for (const obj of response.Contents) {
                if (!obj.Key || obj.Key === prefix) continue
                const name = obj.Key.slice(prefix.length)
                if (!name) continue
                entries.push({
                    name,
                    isDirectory: false,
                    size: obj.Size || 0,
                    updatedAt: obj.LastModified || new Date()
                })
            }
        }

        return entries
    }

    async stat(remotePath: string) {
        if (!this.client || !this.bucket) throw new Error('Not connected')
        const key = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath

        try {
            const response = await this.client.send(new HeadObjectCommand({
                Bucket: this.bucket,
                Key: key
            }))
            return {
                size: response.ContentLength || 0,
                mtime: response.LastModified ? response.LastModified.getTime() / 1000 : 0,
                mode: 0o100000 // Regular file
            }
        } catch (err) {
            // Check if it's a directory (prefix)
            const list = await this.list(remotePath)
            if (list.length > 0 || remotePath === '/' || remotePath === '') {
                return {
                    size: 0,
                    mtime: Date.now() / 1000,
                    mode: 0o40000 // Directory
                }
            }
            throw err
        }
    }

    async get(remotePath: string, localPath: string, signal?: AbortSignal) {
        if (!this.client || !this.bucket) throw new Error('Not connected')
        const key = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath
        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: key
        }))
        if (!response.Body) throw new Error('Empty body')
        const body = response.Body as Readable
        const writer = createWriteStream(localPath)

        const onAbort = () => {
            body.destroy()
            writer.destroy()
        }
        if (signal?.aborted) {
            onAbort()
            throw new Error('Aborted')
        }
        signal?.addEventListener('abort', onAbort)

        return new Promise((resolve, reject) => {
            body.pipe(writer)
            writer.on('finish', () => resolve(true))
            writer.on('error', reject)
            body.on('error', reject)
        }).finally(() => {
            signal?.removeEventListener('abort', onAbort)
        })
    }

    async put(localPath: string, remotePath: string, signal?: AbortSignal) {
        if (!this.client || !this.bucket) throw new Error('Not connected')
        const key = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath
        const upload = new Upload({
            client: this.client,
            params: {
                Bucket: this.bucket,
                Key: key,
                Body: createReadStream(localPath)
            }
        })

        if (signal?.aborted) {
            upload.abort()
            throw new Error('Aborted')
        }

        const onAbort = () => {
            upload.abort()
        }
        signal?.addEventListener('abort', onAbort)

        try {
            await upload.done()
            return true
        } finally {
            signal?.removeEventListener('abort', onAbort)
        }
    }

    async getWithProgress(
        remotePath: string,
        localPath: string,
        onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void,
        offset: number = 0,
        signal?: AbortSignal
    ) {
        if (!this.client || !this.bucket) throw new Error('Not connected')
        const key = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath

        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Range: offset > 0 ? `bytes=${offset}-` : undefined
        }))

        const totalSize = response.ContentLength || 0
        const body = response.Body as Readable
        const writer = createWriteStream(localPath, { flags: offset > 0 ? 'a' : 'w' })

        let transferred = offset
        body.on('data', (chunk) => {
            transferred += chunk.length
            onProgress(transferred, chunk.length, totalSize + offset)
        })

        const onAbort = () => {
            body.destroy()
            writer.destroy()
        }
        if (signal?.aborted) {
            onAbort()
            throw new Error('Aborted')
        }
        signal?.addEventListener('abort', onAbort)

        return new Promise((resolve, reject) => {
            body.pipe(writer)
            writer.on('finish', () => resolve(true))
            writer.on('error', reject)
            body.on('error', reject)
        }).finally(() => {
            signal?.removeEventListener('abort', onAbort)
        })
    }

    async putWithProgress(
        localPath: string,
        remotePath: string,
        onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void,
        offset: number = 0,
        signal?: AbortSignal
    ) {
        if (!this.client || !this.bucket) throw new Error('Not connected')
        const key = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath

        const stats = await fs.stat(localPath)
        const totalSize = stats.size

        const upload = new Upload({
            client: this.client,
            params: {
                Bucket: this.bucket,
                Key: key,
                Body: createReadStream(localPath)
            },
            queueSize: 4,
            partSize: 5 * 1024 * 1024 // 5MB
        })

        upload.on('httpUploadProgress', (progress) => {
            if (progress.loaded) {
                onProgress(progress.loaded + (offset ? 0 : 0), 0, progress.total || totalSize)
            }
        })

        const onAbort = () => {
            upload.abort()
        }
        if (signal?.aborted) {
            onAbort()
            throw new Error('Aborted')
        }
        signal?.addEventListener('abort', onAbort)

        try {
            await upload.done()
            return true
        } finally {
            signal?.removeEventListener('abort', onAbort)
        }
    }

    async readFile(remotePath: string): Promise<string> {
        if (!this.client || !this.bucket) throw new Error('Not connected')
        const key = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath

        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: key
        }))

        const body = await response.Body?.transformToString()
        return body || ''
    }

    async writeFile(remotePath: string, content: string): Promise<boolean> {
        if (!this.client || !this.bucket) throw new Error('Not connected')
        const key = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath

        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: content
        }))
        return true
    }

    disconnect() {
        if (this.client) {
            this.client.destroy()
            this.client = null
            this.bucket = null
        }
    }
}

export const s3Handler = new S3Handler()
