import { Client, ConnectConfig, SFTPWrapper, ClientChannel, Stats } from 'ssh2'
import fs from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import path from 'node:path'
import { SSHProfile, FileEntry } from '../../src/types'

export class SSHHandler {
    private client: Client | null = null
    private sftp: SFTPWrapper | null = null
    private stream: ClientChannel | null = null

    async connect(config: Partial<SSHProfile>): Promise<{ status: string }> {
        if (this.client) {
            this.disconnect()
        }

        const connectConfig: ConnectConfig = {
            host: config.host,
            port: config.port,
            username: config.username,
        }

        if (config.useAgent) {
            // Priority 1: SSH Agent (e.g. 1Password or system ssh-agent)
            connectConfig.agent = process.env.SSH_AUTH_SOCK
        } else if (config.privateKeyPath) {
            // Priority 2: Explicit Private Key
            try {
                const keyContent = await fs.readFile(config.privateKeyPath)
                connectConfig.privateKey = keyContent
                if (config.passphrase) {
                    connectConfig.passphrase = config.passphrase
                }
            } catch (err) {
                throw new Error(`Failed to read private key: ${err instanceof Error ? err.message : String(err)}`)
            }
        } else if (config.password) {
            // Priority 3: Password
            connectConfig.password = config.password
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
                this.client = null
                reject(err)
            }).connect(connectConfig)
        })
    }

    async list(path: string): Promise<FileEntry[]> {
        if (!this.sftp) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            this.sftp!.readdir(path, (err, list) => {
                if (err) reject(err)
                resolve(list.map(item => ({
                    name: item.filename,
                    isDirectory: (item.attrs.mode & 0x4000) === 0x4000,
                    size: item.attrs.size,
                    updatedAt: new Date(item.attrs.mtime * 1000)
                })))
            })
        })
    }

    async stat(remotePath: string) {
        if (!this.sftp) throw new Error('Not connected')
        return this.sftpStat(remotePath)
    }

    private async sftpStat(remotePath: string): Promise<Stats> {
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
                // Ignore error if it already exists (SSH_FX_FAILURE usually)
                if (err && (err as { code?: number }).code !== 4) {
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

    async getWithProgress(remotePath: string, localPath: string, onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void, offset: number = 0) {
        if (!this.sftp) throw new Error('Not connected')

        const stats = await this.sftpStat(remotePath)
        const isDirectory = (stats.mode & 0x4000) === 0x4000

        if (isDirectory) {
            const totalSize = await this.getRemoteDirSize(remotePath)
            // Empty callback for onFileProgress if not needed, or just remove from signature if possible.
            // But downloadDirWithProgress requires it. Let's provide a simplified call.
            return this.downloadDirWithProgress(remotePath, localPath, () => { }, onProgress, totalSize)
        }

        if (offset > 0) {
            return new Promise((resolve, reject) => {
                const totalSize = stats.size
                const remoteStream = this.sftp!.createReadStream(remotePath, { start: offset })
                const localStream = createWriteStream(localPath, { flags: 'a' })

                let transferred = offset
                remoteStream.on('data', (chunk: Buffer) => {
                    transferred += chunk.length
                    onProgress(transferred, chunk.length, totalSize)
                })

                remoteStream.pipe(localStream)

                localStream.on('finish', () => resolve(true))
                localStream.on('error', reject)
                remoteStream.on('error', reject)
            })
        }

        return new Promise((resolve, reject) => {
            this.sftp!.fastGet(remotePath, localPath, {
                step: (totalTransferred, chunk, totalSize) => {
                    onProgress(totalTransferred, chunk, totalSize)
                }
            }, (err) => {
                if (err) reject(err)
                else resolve(true)
            })
        })
    }

    private async getRemoteDirSize(remotePath: string): Promise<number> {
        let size = 0
        const list = await this.list(remotePath)
        for (const item of list) {
            const itemPath = path.posix.join(remotePath, item.name)
            if (item.isDirectory) {
                size += await this.getRemoteDirSize(itemPath)
            } else {
                size += item.size
            }
        }
        return size
    }

    private async downloadDirWithProgress(
        remotePath: string,
        localPath: string,
        onFileProgress: (totalTransferred: number, chunk: number, totalSize: number) => void,
        onGlobalProgress: (totalTransferred: number, chunk: number, totalSize: number) => void,
        totalSize: number,
        state = { transferred: 0 }
    ) {
        await fs.mkdir(localPath, { recursive: true })
        const list = await this.list(remotePath)

        for (const item of list) {
            const remoteItemPath = path.posix.join(remotePath, item.name)
            const localItemPath = path.join(localPath, item.name)

            if (item.isDirectory) {
                await this.downloadDirWithProgress(remoteItemPath, localItemPath, onFileProgress, onGlobalProgress, totalSize, state)
            } else {
                await new Promise<void>((resolve, reject) => {
                    let lastFileTransferred = 0
                    this.sftp!.fastGet(remoteItemPath, localItemPath, {
                        step: (totalFileTransferred) => {
                            const chunk = totalFileTransferred - lastFileTransferred
                            state.transferred += chunk
                            lastFileTransferred = totalFileTransferred
                            onGlobalProgress(state.transferred, chunk, totalSize)
                        }
                    }, (err) => {
                        if (err) reject(err)
                        else resolve()
                    })
                })
            }
        }
        return true
    }

    private async downloadDir(remotePath: string, localPath: string) {
        // Fallback for non-progress download
        await fs.mkdir(localPath, { recursive: true })
        const list = await this.list(remotePath)

        for (const item of list) {
            const remoteItemPath = path.posix.join(remotePath, item.name)
            const localItemPath = path.join(localPath, item.name)

            if (item.isDirectory) {
                await this.downloadDir(remoteItemPath, localItemPath)
            } else {
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

    async putWithProgress(localPath: string, remotePath: string, onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void, offset: number = 0) {
        if (!this.sftp) throw new Error('Not connected')

        const stats = await fs.stat(localPath)
        if (stats.isDirectory()) {
            const totalSize = await this.getLocalDirSize(localPath)
            return this.uploadDirWithProgress(localPath, remotePath, onProgress, totalSize)
        }

        if (offset > 0) {
            return new Promise((resolve, reject) => {
                const totalSize = stats.size
                const localStream = createReadStream(localPath, { start: offset })
                // For SFTP put resume, we need to open the file with write/append and seek.
                // createWriteStream in ssh2 doesn't easily support flags like 'a' for resume?
                // Actually, createWriteStream(path, { flags: 'a' }) works in many SFTP implementations if supported.
                const remoteStream = this.sftp!.createWriteStream(remotePath, { flags: 'a' })

                let transferred = offset
                localStream.on('data', (chunk: Buffer) => {
                    transferred += chunk.length
                    onProgress(transferred, chunk.length, totalSize)
                })

                localStream.pipe(remoteStream)

                remoteStream.on('finish', () => resolve(true))
                remoteStream.on('error', reject)
                localStream.on('error', reject)
            })
        }

        return new Promise((resolve, reject) => {
            this.sftp!.fastPut(localPath, remotePath, {
                step: (totalTransferred, chunk, totalSize) => {
                    onProgress(totalTransferred, chunk, totalSize)
                }
            }, (err) => {
                if (err) reject(err)
                else resolve(true)
            })
        })
    }

    private async getLocalDirSize(localPath: string): Promise<number> {
        let size = 0
        const entries = await fs.readdir(localPath, { withFileTypes: true })
        for (const entry of entries) {
            const fullPath = path.join(localPath, entry.name)
            if (entry.isDirectory()) {
                size += await this.getLocalDirSize(fullPath)
            } else {
                const stats = await fs.stat(fullPath)
                size += stats.size
            }
        }
        return size
    }

    private async uploadDirWithProgress(
        localPath: string,
        remotePath: string,
        onGlobalProgress: (totalTransferred: number, chunk: number, totalSize: number) => void,
        totalSize: number,
        state = { transferred: 0 }
    ) {
        await this.sftpMkdir(remotePath)
        const entries = await fs.readdir(localPath, { withFileTypes: true })

        for (const entry of entries) {
            const localEntryPath = path.join(localPath, entry.name)
            const remoteEntryPath = path.posix.join(remotePath, entry.name)

            if (entry.isDirectory()) {
                await this.uploadDirWithProgress(localEntryPath, remoteEntryPath, onGlobalProgress, totalSize, state)
            } else {
                await new Promise<void>((resolve, reject) => {
                    let lastFileTransferred = 0
                    this.sftp!.fastPut(localEntryPath, remoteEntryPath, {
                        step: (totalFileTransferred) => {
                            const chunk = totalFileTransferred - lastFileTransferred
                            state.transferred += chunk
                            lastFileTransferred = totalFileTransferred
                            onGlobalProgress(state.transferred, chunk, totalSize)
                        }
                    }, (err) => {
                        if (err) reject(err)
                        else resolve()
                    })
                })
            }
        }
        return true
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
