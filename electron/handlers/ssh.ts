import { Client, ConnectConfig, SFTPWrapper, ClientChannel } from 'ssh2'
import fs from 'node:fs/promises'
import path from 'node:path'

export class SSHHandler {
    private client: Client | null = null
    private sftp: SFTPWrapper | null = null
    private stream: ClientChannel | null = null

    async connect(config: ConnectConfig) {
        if (this.client) {
            this.disconnect()
        }
        return new Promise((resolve, reject) => {
            this.client = new Client()

            this.client.on('ready', () => {
                this.client!.sftp((err, sftp) => {
                    if (err) reject(err)
                    this.sftp = sftp
                    resolve({ status: 'connected' })
                })
            }).on('error', (err) => {
                this.client = null // Ensure cleanup on error
                reject(err)
            }).connect(config)
        })
    }

    async list(path: string) {
        if (!this.sftp) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            this.sftp!.readdir(path, (err, list) => {
                if (err) reject(err)
                resolve(list.map(item => ({
                    name: item.filename,
                    // Check if directory bit is set (S_IFDIR = 0x4000)
                    isDirectory: (item.attrs.mode & 0x4000) === 0x4000,
                    size: item.attrs.size,
                    updatedAt: new Date(item.attrs.mtime * 1000)
                })))
            })
        })
    }

    private async sftpStat(remotePath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.sftp!.stat(remotePath, (err, stats) => {
                if (err) reject(err)
                else resolve(stats)
            })
        })
    }

    private async sftpMkdir(remotePath: string) {
        return new Promise<void>((resolve) => {
            this.sftp!.mkdir(remotePath, (err) => {
                // Ignore error if it already exists (SSH_FX_FAILURE usually, ideally check code)
                if (err && (err as any).code !== 4) { // 4 is typical for failure, but explicit check is better. Simplified for now.
                    // Often we should check if it exists first.
                    console.warn('mkdir error (might exist):', err)
                }
                resolve()
            })
        })
    }

    async get(remotePath: string, localPath: string) {
        if (!this.sftp) throw new Error('Not connected')

        const stats = await this.sftpStat(remotePath)
        const isDirectory = (stats.mode & 0x4000) === 0x4000

        if (isDirectory) {
            return this.downloadDir(remotePath, localPath)
        }

        return new Promise((resolve, reject) => {
            this.sftp!.fastGet(remotePath, localPath, (err) => {
                if (err) reject(err)
                resolve(true)
            })
        })
    }

    private async downloadDir(remotePath: string, localPath: string) {
        await fs.mkdir(localPath, { recursive: true })
        const list: any[] = await this.list(remotePath) as any[]

        for (const item of list) {
            const remoteItemPath = path.posix.join(remotePath, item.name)
            const localItemPath = path.join(localPath, item.name)

            if (item.isDirectory) {
                await this.downloadDir(remoteItemPath, localItemPath)
            } else {
                // Use fastGet directly to avoid recursion
                await new Promise<void>((resolve, reject) => {
                    this.sftp!.fastGet(remoteItemPath, localItemPath, (err) => {
                        if (err) reject(err)
                        else resolve()
                    })
                })
            }
        }
        return true
    }

    async put(localPath: string, remotePath: string) {
        if (!this.sftp) throw new Error('Not connected')

        const stats = await fs.stat(localPath)
        if (stats.isDirectory()) {
            return this.uploadDir(localPath, remotePath)
        }

        return new Promise((resolve, reject) => {
            this.sftp!.fastPut(localPath, remotePath, (err) => {
                if (err) reject(err)
                resolve(true)
            })
        })
    }

    private async uploadDir(localPath: string, remotePath: string) {
        await this.sftpMkdir(remotePath)
        const entries = await fs.readdir(localPath, { withFileTypes: true })

        for (const entry of entries) {
            const localEntryPath = path.join(localPath, entry.name)
            const remoteEntryPath = path.posix.join(remotePath, entry.name)

            if (entry.isDirectory()) {
                await this.uploadDir(localEntryPath, remoteEntryPath)
            } else {
                // Use fastPut directly to avoid recursion
                await new Promise<void>((resolve, reject) => {
                    this.sftp!.fastPut(localEntryPath, remoteEntryPath, (err) => {
                        if (err) reject(err)
                        else resolve()
                    })
                })
            }
        }
        return true
    }

    async readFile(remotePath: string): Promise<string> {
        if (!this.sftp) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            this.sftp!.readFile(remotePath, 'utf8', (err, data) => {
                if (err) reject(err)
                else resolve(data.toString())
            })
        })
    }

    async writeFile(remotePath: string, content: string): Promise<boolean> {
        if (!this.sftp) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            const buffer = Buffer.from(content, 'utf8')
            this.sftp!.writeFile(remotePath, buffer, (err) => {
                if (err) reject(err)
                else resolve(true)
            })
        })
    }

    async spawnShell(rows: number, cols: number, onData: (data: string) => void) {
        if (!this.client) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            this.client!.shell({ rows, cols, term: 'xterm-256color' }, (err, stream) => {
                if (err) return reject(err)

                this.stream = stream

                stream.on('close', () => {
                    this.stream = null
                    // Maybe notify renderer?
                }).on('data', (data: Buffer) => {
                    onData(data.toString())
                })

                resolve(true)
            })
        })
    }

    async writeShell(data: string) {
        if (!this.stream) return
        this.stream.write(data)
    }

    async resizeShell(rows: number, cols: number) {
        if (!this.stream) return
        this.stream.setWindow(rows, cols, 0, 0)
    }

    disconnect() {
        if (this.client) {
            if (this.stream) {
                this.stream.end()
                this.stream = null
            }
            this.client.end()
            this.client = null
            this.sftp = null
        }
    }
}

export const sshHandler = new SSHHandler()
