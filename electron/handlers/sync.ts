import fs from 'node:fs/promises'
import path from 'node:path'
import { remoteDispatcher } from './remote'

export interface SyncDiff {
    name: string
    localPath: string
    remotePath: string
    status: 'only-local' | 'only-remote' | 'newer-local' | 'newer-remote' | 'same'
    localSize?: number
    remoteSize?: number
    localMtime?: Date
    remoteMtime?: Date
}

export class SyncEngine {
    async compare(localDir: string, remoteDir: string): Promise<SyncDiff[]> {
        const localFiles = await fs.readdir(localDir, { withFileTypes: true })
        const remoteFiles = await remoteDispatcher.list(remoteDir)

        const diffs: SyncDiff[] = []
        const remoteMap = new Map(remoteFiles.map(f => [f.name, f]))

        // Check local files
        for (const local of localFiles) {
            if (local.isDirectory()) continue // Skip directories for now, recursive sync is future work

            const localPath = path.join(localDir, local.name)
            const remotePath = path.posix.join(remoteDir, local.name)
            const localStat = await fs.stat(localPath)

            const remote = remoteMap.get(local.name)

            if (!remote) {
                diffs.push({
                    name: local.name,
                    localPath,
                    remotePath,
                    status: 'only-local',
                    localSize: localStat.size,
                    localMtime: localStat.mtime
                })
            } else {
                remoteMap.delete(local.name)
                const localTime = localStat.mtime.getTime()
                const remoteTime = remote.updatedAt.getTime()

                // Allow 1s margin for filesystem precision differences
                const isNewerLocal = localTime > remoteTime + 1000
                const isNewerRemote = remoteTime > localTime + 1000
                const isSameSize = localStat.size === remote.size

                let status: SyncDiff['status'] = 'same'
                if (isNewerLocal) status = 'newer-local'
                else if (isNewerRemote) status = 'newer-remote'
                else if (!isSameSize) status = 'newer-local' // Fallback if size differs but time is sameish

                diffs.push({
                    name: local.name,
                    localPath,
                    remotePath,
                    status,
                    localSize: localStat.size,
                    remoteSize: remote.size,
                    localMtime: localStat.mtime,
                    remoteMtime: remote.updatedAt
                })
            }
        }

        // Check remaining remote files
        for (const [name, remote] of remoteMap) {
            if (remote.isDirectory) continue

            diffs.push({
                name,
                localPath: path.join(localDir, name),
                remotePath: path.posix.join(remoteDir, name),
                status: 'only-remote',
                remoteSize: remote.size,
                remoteMtime: remote.updatedAt
            })
        }

        return diffs
    }
}

export const syncEngine = new SyncEngine()
