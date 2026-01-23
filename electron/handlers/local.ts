import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

import { IpcMainInvokeEvent } from 'electron'

export async function handleLocalList(_event: IpcMainInvokeEvent, dirPath: string) {
    try {
        const targetPath = dirPath || os.homedir()
        const entries = await fs.readdir(targetPath, { withFileTypes: true })

        const results = await Promise.all(entries.map(async (entry) => {
            try {
                const fullPath = path.join(targetPath, entry.name)
                const stats = await fs.stat(fullPath)
                return {
                    name: entry.name,
                    isDirectory: entry.isDirectory(),
                    size: stats.size,
                    path: fullPath,
                    updatedAt: stats.mtime
                }
            } catch (err) {
                // If we can't stat the file (e.g. permission issue), skip it or return partial info
                console.warn(`Failed to stat ${entry.name}`, err)
                return null
            }
        }))

        return results.filter(Boolean)
    } catch (error) {
        throw new Error(`Failed to list local directory: ${(error as Error).message}`)
    }
}
