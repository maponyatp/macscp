import { useState, useEffect, useCallback } from 'react'
import { Folder, File, ArrowLeft, RefreshCw, HardDrive, Server, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { AppSettings, defaultSettings } from '../types'
import { FileEditor } from './FileEditor'

interface FileEntry {
    name: string
    isDirectory: boolean
    size: number
    updatedAt: Date
}

interface ElectronFile extends File {
    path: string
}

interface FileListProps {
    title: string
    icon: LucideIcon
    path: string
    onPathChange: (path: string) => void
    loadFiles: (path: string) => Promise<FileEntry[]>
    onTransfer?: (file: FileEntry) => void
    onDropFiles?: (files: FileList) => void
    showHiddenFiles: boolean
    refreshTrigger?: number
    onContextMenu?: (e: React.MouseEvent, file: FileEntry) => void
}

function FileList({
    title,
    icon: Icon,
    path,
    onPathChange,
    loadFiles,
    onTransfer,
    onDropFiles,
    showHiddenFiles,
    refreshTrigger,
    onContextMenu
}: FileListProps) {
    const [files, setFiles] = useState<FileEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const [pathInput, setPathInput] = useState(path)

    // Sync pathInput when path changes externally (e.g., clicking folders)
    useEffect(() => {
        setPathInput(path)
    }, [path])

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await loadFiles(path)

            // Filter hidden files
            const filteredData = showHiddenFiles
                ? data
                : data.filter(f => !f.name.startsWith('.'))

            // Sort: folders first, then files
            setFiles(filteredData.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
                return a.isDirectory ? -1 : 1
            }))
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            setError(message)
        } finally {
            setLoading(false)
        }
    }, [path, loadFiles, showHiddenFiles])

    useEffect(() => {
        refresh()
    }, [refresh, refreshTrigger])

    function handleNavigate(entry: FileEntry) {
        if (entry.isDirectory) {
            // Ensure we don't have trailing slash on current path
            const cleanPath = path.replace(/\/+$/, '') || '/'
            // Build new path
            const newPath = cleanPath === '/' ? `/${entry.name}` : `${cleanPath}/${entry.name}`
            // Normalize to remove any double slashes
            const normalized = newPath.replace(/\/+/g, '/')
            onPathChange(normalized)
        }
    }

    function handleUp() {
        if (path === '/' || path === '') return
        const parts = path.split('/').filter(Boolean)
        parts.pop()
        const newPath = '/' + parts.join('/')
        onPathChange(newPath || '/')
    }

    const handlePathSubmit = () => {
        if (pathInput !== path && pathInput.trim()) {
            onPathChange(pathInput)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        if (!onDropFiles) return
        setIsDraggingOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDraggingOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDraggingOver(false)
        if (!onDropFiles) return

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onDropFiles(e.dataTransfer.files)
        }
    }

    return (
        <div
            className={`flex flex-col h-full border rounded-xl overflow-hidden transition-colors ${isDraggingOver
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-zinc-700 bg-zinc-800/30'
                }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Header */}
            <div className="bg-zinc-900/50 p-3 border-b border-zinc-700 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                    <Icon className="h-4 w-4" />
                    {title}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleUp}
                        disabled={path === '/' || path === ''}
                        className="p-1 hover:bg-zinc-700 rounded disabled:opacity-50"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <input
                        className="flex-1 bg-zinc-950/50 border border-zinc-700 rounded px-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                        value={pathInput}
                        onChange={(e) => setPathInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handlePathSubmit()
                                e.currentTarget.blur()
                            } else if (e.key === 'Escape') {
                                setPathInput(path)
                                e.currentTarget.blur()
                            }
                        }}
                        onBlur={() => {
                            // Reset to actual path if user didn't submit
                            setPathInput(path)
                        }}
                        placeholder="Enter path..."
                    />
                    <button
                        onClick={refresh}
                        className={`p-1 hover:bg-zinc-700 rounded ${loading ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-2">
                {error ? (
                    <div className="text-red-400 text-xs p-2 text-center">{error}</div>
                ) : (
                    <div className="space-y-0.5">
                        {files.map((file) => (
                            <div
                                key={file.name}
                                onContextMenu={(e) => onContextMenu?.(e, file)}
                                className={`
                            group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer select-none text-sm
                            ${file.isDirectory ? 'text-blue-100 hover:bg-blue-500/20' : 'text-zinc-300 hover:bg-zinc-700/50'}
                        `}
                            >
                                <div
                                    className="flex-1 flex items-center gap-2 overflow-hidden"
                                    onClick={() => handleNavigate(file)}
                                >
                                    {file.isDirectory ? (
                                        <Folder className="h-4 w-4 text-blue-400" />
                                    ) : (
                                        <File className="h-4 w-4 text-zinc-500" />
                                    )}
                                    <span className="truncate">{file.name}</span>
                                </div>

                                {!file.isDirectory && onTransfer && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onTransfer(file)
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-600 rounded text-xs px-2 bg-zinc-700 text-zinc-300"
                                        title={title === 'Local' ? 'Upload' : 'Download'}
                                    >
                                        {title === 'Local' ? 'Upload' : 'Download'}
                                    </button>
                                )}

                                <span className="text-xs text-zinc-600 font-mono w-16 text-right">
                                    {!file.isDirectory && (file.size / 1024).toFixed(1) + ' KB'}
                                </span>
                            </div>
                        ))}
                        {files.length === 0 && !loading && (
                            <div className="text-zinc-500 text-xs text-center py-4">Empty folder</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export function FileExplorer({ settings = defaultSettings }: { settings?: AppSettings }) {
    const [localPath, setLocalPath] = useState(settings.defaultLocalPath || '/')
    const [remotePath, setRemotePath] = useState('/root') // Default for VPS, configurable
    const [transferring, setTransferring] = useState(false)
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: FileEntry } | null>(null)
    const [editingFile, setEditingFile] = useState<string | null>(null)

    // Close context menu on global click
    useEffect(() => {
        const handleClick = () => setContextMenu(null)
        window.addEventListener('click', handleClick)
        return () => window.removeEventListener('click', handleClick)
    }, [])

    // Update local path if settings change (optional, might be annoying if user navigated elsewhere)
    useEffect(() => {
        if (settings.defaultLocalPath && settings.defaultLocalPath !== '/') {
            // Only set if we are at root or uninitialized? 
            // For now, let's respect it on mount or if explicitly requested.
            // Actually, useState default value only runs once.
        }
    }, [settings.defaultLocalPath])

    async function handleUpload(file: FileEntry) {
        if (transferring) return
        setTransferring(true)
        const toastId = toast.loading(`Uploading ${file.name}...`)
        try {
            await window.api.sshPut(
                localPath === '/' ? `/${file.name}` : `${localPath}/${file.name}`,
                remotePath === '/' ? `/${file.name}` : `${remotePath}/${file.name}`
            )
            toast.success('Upload complete', { id: toastId })
            setRefreshTrigger(p => p + 1)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            toast.error('Upload failed: ' + message, { id: toastId })
        } finally {
            setTransferring(false)
        }
    }

    async function handleDownload(file: FileEntry) {
        if (transferring) return
        setTransferring(true)
        const toastId = toast.loading(`Downloading ${file.name}...`)
        try {
            await window.api.sshGet(
                remotePath === '/' ? `/${file.name}` : `${remotePath}/${file.name}`,
                localPath === '/' ? `/${file.name}` : `${localPath}/${file.name}`
            )
            toast.success('Download complete', { id: toastId })
            setRefreshTrigger(p => p + 1)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            toast.error('Download failed: ' + message, { id: toastId })
        } finally {
            setTransferring(false)
        }
    }

    async function handleRemoteDrop(files: FileList) {
        if (transferring) return
        setTransferring(true)
        const toastId = toast.loading(`Uploading ${files.length} file(s)...`)
        try {
            let successCount = 0
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                // Electron provides the full path in the File object
                const localFilePath = (file as ElectronFile).path
                if (!localFilePath) {
                    console.error('No path found for dropped file:', file.name)
                    continue
                }

                await window.api.sshPut(
                    localFilePath,
                    remotePath === '/' ? `/${file.name}` : `${remotePath}/${file.name}`
                )
                successCount++
            }
            if (successCount > 0) {
                toast.success(`Uploaded ${successCount} file(s)`, { id: toastId })
                setRefreshTrigger(p => p + 1)
            } else {
                toast.dismiss(toastId)
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            toast.error('Upload failed: ' + message, { id: toastId })
        } finally {
            setTransferring(false)
        }
    }

    return (
        <div className="h-full flex gap-4 p-4">
            <div className="flex-1 min-w-0">
                <FileList
                    title="Local"
                    icon={HardDrive}
                    path={localPath}
                    onPathChange={setLocalPath}
                    loadFiles={(p) => window.api.localList(p)}
                    onTransfer={handleUpload}
                    showHiddenFiles={settings.showHiddenFiles}
                    refreshTrigger={refreshTrigger}
                />
            </div>
            <div className="flex-1 min-w-0">
                <FileList
                    title="Remote"
                    icon={Server}
                    path={remotePath}
                    onPathChange={setRemotePath}
                    loadFiles={(p) => window.api.sshList(p)}
                    onTransfer={handleDownload}
                    onDropFiles={handleRemoteDrop}
                    showHiddenFiles={settings.showHiddenFiles}
                    refreshTrigger={refreshTrigger}
                    onContextMenu={(e, file) => {
                        e.preventDefault()
                        setContextMenu({ x: e.clientX, y: e.clientY, file })
                    }}
                />
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-zinc-800 border border-zinc-700 rounded shadow-xl py-1 z-50 min-w-[160px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-1.5 text-xs text-zinc-500 border-b border-zinc-700 mb-1 font-medium truncate max-w-[200px]">
                        {contextMenu.file.name}
                    </div>

                    {!contextMenu.file.isDirectory && (
                        <button
                            className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors flex items-center gap-2"
                            onClick={() => {
                                const fullPath = remotePath === '/'
                                    ? `/${contextMenu.file.name}`
                                    : `${remotePath}/${contextMenu.file.name}`
                                setEditingFile(fullPath)
                                setContextMenu(null)
                            }}
                        >
                            Edit File
                        </button>
                    )}

                    <button
                        className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                        onClick={() => {
                            handleDownload(contextMenu.file)
                            setContextMenu(null)
                        }}
                    >
                        Download
                    </button>
                </div>
            )}

            {/* File Editor */}
            {editingFile && (
                <FileEditor
                    remotePath={editingFile}
                    onClose={() => setEditingFile(null)}
                />
            )}

            {transferring && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700 flex items-center gap-3">
                        <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                        <span>Transferring...</span>
                    </div>
                </div>
            )}
        </div>
    )
}
