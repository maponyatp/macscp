import { Client, ConnectConfig, SFTPWrapper, ClientChannel } from 'ssh2'
import fs from 'node:fs/promises'
import path from 'node:path'
import { SSHProfile, FileEntry } from '../../src/types'

export class SSHHandler {
    private client: Client | null = null
    private sftp: SFTPWrapper | null = null // For metadata operations (shared)
    private stream: ClientChannel | null = null // For shell (shared)

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
            connectConfig.agent = process.env.SSH_AUTH_SOCK
        } else if (config.privateKeyPath) {
            try {
                const keyContent = await fs.readFile(config.privateKeyPath)
                connectConfig.privateKey = keyContent
            } catch (err) {
                console.error('Failed to read private key:', err)
                throw new Error('Could not read private key file')
            }
        } else if (config.password) {
            connectConfig.password = config.password
        }

        return new Promise((resolve, reject) => {
            const client = new Client()
            this.client = client

            client.on('ready', () => {
                client.sftp((err, sftp) => {
                    if (err) {
                        this.disconnect()
                        reject(err)
                        return
                    }
                    this.sftp = sftp
                    resolve({ status: 'connected' })
                })
            }).on('error', (err: Error) => {
                this.client = null
                reject(err)
            }).connect(connectConfig)
        })
    }

    async list(remotePath: string): Promise<FileEntry[]> {
        if (!this.sftp) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            this.sftp!.readdir(remotePath, (err, list) => {
                if (err) {
                    reject(new Error(`Failed to list remote directory: ${err.message}`))
                    return
                }

                const entries: FileEntry[] = list.map(item => ({
                    name: item.filename,
                    isDirectory: item.attrs.isDirectory(),
                    size: item.attrs.size,
                    updatedAt: new Date(item.attrs.mtime * 1000),
                }))
                resolve(entries)
            })
        })
    }

    /**
     * Creates a new SFTP channel for a single operation to avoid sharing state or bottlenecks.
     */
    private async getSftp(): Promise<SFTPWrapper> {
        if (!this.client) throw new Error('Not connected')
        return new Promise((resolve, reject) => {
            this.client!.sftp((err, sftp) => {
                if (err) reject(err)
                else resolve(sftp)
            })
        })
    }

    private async sftpMkdir(remotePath: string, sftp: SFTPWrapper) {
        return new Promise<void>((resolve) => {
            sftp.mkdir(remotePath, (err: Error | null | undefined) => {
                if (err && (err as { code?: number }).code !== 4) {
                    console.warn('mkdir error (might exist):', err)
                }
                resolve()
            })
        })
    }

    async get(remotePath: string, localPath: string, signal?: AbortSignal) {
        const sftp = await this.getSftp()
        return new Promise((resolve, reject) => {
            const onAbort = () => reject(new Error('Aborted'))
            if (signal?.aborted) return reject(new Error('Aborted'))
            signal?.addEventListener('abort', onAbort)

            sftp.fastGet(remotePath, localPath, (err: Error | null | undefined) => {
                signal?.removeEventListener('abort', onAbort)
                sftp.end() // Close channel
                if (err) reject(err)
                else resolve(true)
            })
        })
    }

    async execCommand(command: string): Promise<string> {
        if (!this.client) throw new Error('Not connected')
        return new Promise((resolve, reject) => {
            this.client!.exec(command, (err, stream) => {
                if (err) return reject(err)
                let stdout = ''
                let stderr = ''
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                stream.on('close', (code: any) => {
                    if (code !== 0) {
                        reject(new Error(`Command failed with exit code ${code}: ${stderr}`))
                    } else {
                        resolve(stdout)
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }).on('data', (data: any) => {
                    stdout += data
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }).stderr.on('data', (data: any) => {
                    stderr += data
                })
            })
        })
    }

    async put(localPath: string, remotePath: string, signal?: AbortSignal) {
        const sftp = await this.getSftp()
        return new Promise((resolve, reject) => {
            const onAbort = () => reject(new Error('Aborted'))
            if (signal?.aborted) return reject(new Error('Aborted'))
            signal?.addEventListener('abort', onAbort)

            sftp.fastPut(localPath, remotePath, (err: Error | null | undefined) => {
                signal?.removeEventListener('abort', onAbort)
                sftp.end() // Close channel
                if (err) reject(err)
                else resolve(true)
            })
        })
    }

    async getWithProgress(
        remotePath: string,
        localPath: string,
        onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void,
        offset: number = 0,
        signal?: AbortSignal
    ) {
        const sftp = await this.getSftp()
        return new Promise((resolve, reject) => {
            const onAbort = () => reject(new Error('Aborted'))
            if (signal?.aborted) return reject(new Error('Aborted'))
            signal?.addEventListener('abort', onAbort)

            sftp.fastGet(remotePath, localPath, {
                step: (totalTransferred, chunk, totalSize) => {
                    if (signal?.aborted) return
                    onProgress(totalTransferred + offset, chunk, totalSize)
                }
            }, (err: Error | null | undefined) => {
                signal?.removeEventListener('abort', onAbort)
                sftp.end()
                if (err) {
                    const error = new Error(`Failed to download file: ${err.message}`)
                        ; (error as Error & { code?: number | string }).code = (err as Error & { code?: number | string }).code
                    reject(error)
                }
                else resolve(true)
            })
        })
    }

    async putWithProgress(
        localPath: string,
        remotePath: string,
        onProgress: (totalTransferred: number, chunk: number, totalSize: number) => void,
        offset: number = 0,
        signal?: AbortSignal
    ) {
        const sftp = await this.getSftp()
        return new Promise((resolve, reject) => {
            const onAbort = () => reject(new Error('Aborted'))
            if (signal?.aborted) return reject(new Error('Aborted'))
            signal?.addEventListener('abort', onAbort)

            sftp.fastPut(localPath, remotePath, {
                step: (totalTransferred, chunk, totalSize) => {
                    if (signal?.aborted) return
                    onProgress(totalTransferred + offset, chunk, totalSize)
                }
            }, (err: Error | null | undefined) => {
                signal?.removeEventListener('abort', onAbort)
                sftp.end()
                if (err) {
                    const error = new Error(`Failed to upload file: ${err.message}`)
                        ; (error as Error & { code?: number | string }).code = (err as Error & { code?: number | string }).code
                    reject(error)
                }
                else resolve(true)
            })
        })
    }

    async stat(remotePath: string) {
        if (!this.sftp) throw new Error('Not connected')
        return new Promise((resolve, reject) => {
            this.sftp!.stat(remotePath, (err, stats) => {
                if (err) reject(err)
                else resolve(stats)
            })
        })
    }

    async downloadDir(remotePath: string, localPath: string, signal?: AbortSignal, sftp?: SFTPWrapper): Promise<boolean> {
        const activeSftp = sftp || await this.getSftp()
        try {
            if (signal?.aborted) throw new Error('Aborted')
            await fs.mkdir(localPath, { recursive: true })
            const list = await this.list(remotePath)

            for (const item of list) {
                if (signal?.aborted) throw new Error('Aborted')
                const localItemPath = path.join(localPath, item.name)
                const remoteItemPath = path.join(remotePath, item.name).replace(/\\/g, '/')

                if (item.isDirectory) {
                    await this.downloadDir(remoteItemPath, localItemPath, signal, activeSftp)
                } else {
                    await new Promise<void>((resolve, reject) => {
                        const onAbort = () => reject(new Error('Aborted'))
                        signal?.addEventListener('abort', onAbort)

                        activeSftp.fastGet(remoteItemPath, localItemPath, (err: Error | null | undefined) => {
                            signal?.removeEventListener('abort', onAbort)
                            if (err) reject(err)
                            else resolve()
                        })
                    })
                }
            }
            return true
        } finally {
            if (!sftp) activeSftp.end()
        }
    }

    async uploadDir(localPath: string, remotePath: string, signal?: AbortSignal, sftp?: SFTPWrapper): Promise<boolean> {
        const activeSftp = sftp || await this.getSftp()
        try {
            if (signal?.aborted) throw new Error('Aborted')
            await this.sftpMkdir(remotePath, activeSftp)
            const entries = await fs.readdir(localPath, { withFileTypes: true })

            for (const entry of entries) {
                if (signal?.aborted) throw new Error('Aborted')
                const localEntryPath = path.join(localPath, entry.name)
                const remoteEntryPath = path.join(remotePath, entry.name).replace(/\\/g, '/')

                if (entry.isDirectory()) {
                    await this.uploadDir(localEntryPath, remoteEntryPath, signal, activeSftp)
                } else {
                    await new Promise<void>((resolve, reject) => {
                        const onAbort = () => reject(new Error('Aborted'))
                        signal?.addEventListener('abort', onAbort)

                        activeSftp.fastPut(localEntryPath, remoteEntryPath, (err: Error | null | undefined) => {
                            signal?.removeEventListener('abort', onAbort)
                            if (err) reject(err)
                            else resolve()
                        })
                    })
                }
            }
            return true
        } finally {
            if (!sftp) activeSftp.end()
        }
    }

    async downloadDirWithProgress(
        remotePath: string,
        localPath: string,
        onFileProgress: (totalTransferred: number, chunk: number, totalSize: number) => void,
        onGlobalProgress: (totalTransferred: number, totalSize: number) => void,
        totalSize: number,
        state: { transferred: number },
        signal?: AbortSignal,
        sftp?: SFTPWrapper
    ): Promise<boolean> {
        const activeSftp = sftp || await this.getSftp()
        try {
            if (signal?.aborted) throw new Error('Aborted')
            await fs.mkdir(localPath, { recursive: true })
            const list = await this.list(remotePath)

            for (const item of list) {
                if (signal?.aborted) throw new Error('Aborted')
                const localItemPath = path.join(localPath, item.name)
                const remoteItemPath = path.join(remotePath, item.name).replace(/\\/g, '/')

                if (item.isDirectory) {
                    await this.downloadDirWithProgress(remoteItemPath, localItemPath, onFileProgress, onGlobalProgress, totalSize, state, signal, activeSftp)
                } else {
                    await new Promise<void>((resolve, reject) => {
                        const onProgress = (totalTransferred: number, chunk: number, totalSize: number) => {
                            if (signal?.aborted) return
                            onFileProgress(totalTransferred, chunk, totalSize)
                        }

                        const onAbort = () => reject(new Error('Aborted'))
                        signal?.addEventListener('abort', onAbort)

                        activeSftp.fastGet(remoteItemPath, localItemPath, {
                            step: (totalFileTransferred, chunk) => {
                                if (signal?.aborted) return
                                state.transferred += chunk
                                onProgress(totalFileTransferred, chunk, item.size)
                                onGlobalProgress(state.transferred, totalSize)
                            }
                        }, (err: Error | null | undefined) => {
                            signal?.removeEventListener('abort', onAbort)
                            if (err) reject(err)
                            else resolve()
                        })
                    })
                }
            }
            return true
        } finally {
            if (!sftp) activeSftp.end()
        }
    }

    async uploadDirWithProgress(
        localPath: string,
        remotePath: string,
        onFileProgress: (totalTransferred: number, chunk: number, totalSize: number) => void,
        onGlobalProgress: (totalTransferred: number, totalSize: number) => void,
        totalSize: number,
        state: { transferred: number },
        signal?: AbortSignal,
        sftp?: SFTPWrapper
    ): Promise<boolean> {
        const activeSftp = sftp || await this.getSftp()
        try {
            if (signal?.aborted) throw new Error('Aborted')
            await this.sftpMkdir(remotePath, activeSftp)
            const entries = await fs.readdir(localPath, { withFileTypes: true })

            for (const entry of entries) {
                if (signal?.aborted) throw new Error('Aborted')
                const localEntryPath = path.join(localPath, entry.name)
                const remoteEntryPath = path.join(remotePath, entry.name).replace(/\\/g, '/')

                if (entry.isDirectory()) {
                    await this.uploadDirWithProgress(localEntryPath, remoteEntryPath, onFileProgress, onGlobalProgress, totalSize, state, signal, activeSftp)
                } else {
                    const stats = await fs.stat(localEntryPath)
                    await new Promise<void>((resolve, reject) => {
                        const onFileProgressLocal = (totalTransferred: number, chunk: number, totalSize: number) => {
                            if (signal?.aborted) return
                            onFileProgress(totalTransferred, chunk, totalSize)
                        }

                        const onAbort = () => reject(new Error('Aborted'))
                        signal?.addEventListener('abort', onAbort)

                        activeSftp.fastPut(localEntryPath, remoteEntryPath, {
                            step: (totalFileTransferred, chunk) => {
                                if (signal?.aborted) return
                                state.transferred += chunk
                                onFileProgressLocal(totalFileTransferred, chunk, stats.size)
                                onGlobalProgress(state.transferred, totalSize)
                            }
                        }, (err: Error | null | undefined) => {
                            signal?.removeEventListener('abort', onAbort)
                            if (err) reject(err)
                            else resolve()
                        })
                    })
                }
            }
            return true
        } finally {
            if (!sftp) activeSftp.end()
        }
    }

    async readFile(remotePath: string): Promise<string> {
        if (!this.sftp) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = []
            const stream = this.sftp!.createReadStream(remotePath)

            stream.on('data', (chunk: Buffer) => chunks.push(chunk))
            stream.on('error', (err: Error) => reject(err))
            stream.on('close', () => {
                resolve(Buffer.concat(chunks).toString('utf8'))
            })
        })
    }

    async readBuffer(remotePath: string): Promise<string> {
        if (!this.sftp) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = []
            const stream = this.sftp!.createReadStream(remotePath)

            stream.on('data', (chunk: Buffer) => chunks.push(chunk))
            stream.on('error', (err: Error) => reject(err))
            // Return base64 string directly for IPC
            stream.on('close', () => {
                resolve(Buffer.concat(chunks).toString('base64'))
            })
        })
    }

    async writeFile(remotePath: string, content: string): Promise<boolean> {
        if (!this.sftp) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            const buffer = Buffer.from(content, 'utf8')
            this.sftp!.writeFile(remotePath, buffer, (err: Error | null | undefined) => {
                if (err) reject(err)
                else resolve(true)
            })
        })
    }

    async spawnShell(rows: number, cols: number, onData: (data: string) => void): Promise<boolean> {
        if (!this.client) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            this.client!.shell({ rows, cols, term: 'xterm-256color' }, (err, stream) => {
                if (err) {
                    reject(err)
                    return
                }
                this.stream = stream
                stream.on('data', (data: Buffer) => {
                    onData(data.toString('utf8'))
                }).on('close', () => {
                    this.stream = null
                })
                resolve(true)
            })
        })
    }

    writeShell(data: string) {
        if (this.stream) {
            this.stream.write(data)
        }
    }

    resizeShell(rows: number, cols: number) {
        if (this.stream) {
            this.stream.setWindow(rows, cols, 0, 0)
        }
    }

    disconnect() {
        if (this.sftp) {
            this.sftp.end()
            this.sftp = null
        }
        if (this.stream) {
            this.stream.end()
            this.stream = null
        }
        if (this.client) {
            this.client.end()
            this.client = null
        }
    }
}

export const sshHandler = new SSHHandler()
