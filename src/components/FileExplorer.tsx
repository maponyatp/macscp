import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Folder, File, ArrowLeft, RefreshCw, HardDrive, Server, type LucideIcon, RefreshCcw, Eye, EyeOff, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { AppSettings, defaultSettings } from '../types'
import { FileEditor } from './FileEditor'
import { SyncDialog } from './SyncDialog'
import { MediaViewer } from './MediaViewer'
import { useVirtualizer } from '@tanstack/react-virtual'

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
    onPreview?: (file: FileEntry, remotePath: string) => void
    onEdit?: (remotePath: string) => void
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
    onContextMenu,
    onPreview,
    onEdit
}: FileListProps) {
    const [files, setFiles] = useState<FileEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const [pathInput, setPathInput] = useState(path)
    const [searchQuery, setSearchQuery] = useState('')

    // Sync pathInput when path changes externally (e.g., clicking folders)
    useEffect(() => {
        setPathInput(path)
        setSearchQuery('') // Clear search when changing directories
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

    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) return files
        const query = searchQuery.toLowerCase()
        return files.filter(f => f.name.toLowerCase().includes(query))
    }, [files, searchQuery])

    const parentRef = useRef<HTMLDivElement>(null)
    const virtualizer = useVirtualizer({
        count: filteredFiles.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 36,
        overscan: 5,
    })

    function handleNavigate(entry: FileEntry) {
        if (entry.isDirectory) {
            // Ensure we don't have trailing slash on current path
            const cleanPath = path.replace(/\/+$/, '') || '/'
            // Build new path
            const newPath = cleanPath === '/' ? `/${entry.name}` : `${cleanPath}/${entry.name}`
            // Normalize to remove any double slashes
            const normalized = newPath.replace(/\/+/g, '/')
            onPathChange(normalized)
        } else if (title === 'Remote') {
            const cleanPath = path.replace(/\/+$/, '') || '/'
            const fullPath = cleanPath === '/' ? `/${entry.name}` : `${cleanPath}/${entry.name}`

            if (entry.name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|pdf)$/i)) {
                onPreview?.(entry, fullPath)
            } else if (!entry.name.match(/\.(zip|tar\.gz|tgz|gz|exe|dll)$/i)) {
                onEdit?.(fullPath)
            }
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

        // 1. Check for internal MacSCP drag
        const internalPath = e.dataTransfer.getData('application/x-macscp-path')
        const sourceType = e.dataTransfer.getData('application/x-macscp-source')

        if (internalPath && sourceType) {
            // Drag within the app
            if (sourceType !== title) {
                // Different pane, trigger transfer
                const fileName = internalPath.split('/').pop() || ''
                onTransfer?.({
                    name: fileName,
                    isDirectory: e.dataTransfer.getData('application/x-macscp-isdir') === 'true',
                    size: parseInt(e.dataTransfer.getData('application/x-macscp-size') || '0'),
                    updatedAt: new Date()
                })
            }
            return
        }

        // 2. Fallback to external files (Finder)
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
            <div className="bg-zinc-900/50 p-3 border-b border-zinc-700 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                        <Icon className="h-4 w-4" />
                        {title}
                    </div>
                    {/* Compact Search Bar in Header */}
                    <div className="flex-1 max-w-[180px] relative group px-2">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 h-3 w-3 transition-colors ${searchQuery ? 'text-blue-400' : 'text-zinc-500 group-focus-within:text-blue-400'}`} />
                        <input
                            className="w-full bg-zinc-950/50 border border-zinc-700/50 rounded-md pl-7 pr-7 py-1 text-[11px] placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter files..."
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-700 rounded text-zinc-500 hover:text-white"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
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
            <div ref={parentRef} className="flex-1 overflow-auto p-2">
                {error ? (
                    <div className="text-red-400 text-xs p-2 text-center">{error}</div>
                ) : (
                    <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }} onDragStart={(e) => {
                        const target = e.target as HTMLElement
                        const fileName = target.getAttribute('data-filename')
                        const isDirectory = target.getAttribute('data-isdir') === 'true'
                        const size = target.getAttribute('data-size')

                        if (!fileName) return

                        const fullPath = path === '/' ? `/${fileName}` : `${path}/${fileName}`

                        // 1. Internal drag data for pane-to-pane transfers
                        e.dataTransfer.setData('application/x-macscp-path', fullPath)
                        e.dataTransfer.setData('application/x-macscp-source', title)
                        e.dataTransfer.setData('application/x-macscp-isdir', isDirectory.toString())
                        e.dataTransfer.setData('application/x-macscp-size', size || '0')

                        // 2. Native macOS drag (Remote -> Finder)
                        if (title === 'Remote' && !isDirectory) {
                            window.api.remoteStartDrag(fullPath)
                        }
                    }}>
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                            const file = filteredFiles[virtualRow.index]
                            return (
                                <div
                                    key={virtualRow.key}
                                    data-index={virtualRow.index}
                                    ref={virtualizer.measureElement}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`
                                    }}
                                    onContextMenu={(e) => onContextMenu?.(e, file)}
                                    draggable={true}
                                    data-filename={file.name}
                                    data-isdir={file.isDirectory}
                                    data-size={file.size}
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

                                    {onTransfer && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onTransfer(file)
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-600 rounded text-xs px-2 bg-zinc-700 text-zinc-300 flex items-center gap-1"
                                            title={title === 'Local' ? 'Upload Folder' : 'Download Folder'}
                                        >
                                            {file.isDirectory && <Folder className="h-3 w-3" />}
                                            {title === 'Local' ? 'Upload' : 'Download'}
                                        </button>
                                    )}

                                    <span className="text-xs text-zinc-600 font-mono w-16 text-right">
                                        {file.isDirectory ? 'DIR' : (file.size / 1024).toFixed(1) + ' KB'}
                                    </span>
                                </div>
                            )
                        })}
                        {filteredFiles.length === 0 && !loading && (
                            <div className="text-zinc-500 text-xs text-center py-4 flex flex-col gap-2 items-center">
                                {searchQuery ? (
                                    <>
                                        <span>No matches found for "{searchQuery}"</span>
                                        <button onClick={() => setSearchQuery('')} className="text-blue-400 hover:underline">Clear filter</button>
                                    </>
                                ) : (
                                    <span>Empty folder</span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export function FileExplorer({ settings = defaultSettings, initialRemotePath }: { settings?: AppSettings, initialRemotePath?: string }) {
    const [localPath, setLocalPath] = useState(settings.defaultLocalPath || '/')
    const [remotePath, setRemotePath] = useState(initialRemotePath || '/root') // Default to /root if not specified
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: FileEntry } | null>(null)
    const [editingFile, setEditingFile] = useState<string | null>(null)
    const [showSync, setShowSync] = useState(false)
    const [isWatching, setIsWatching] = useState(false)
    const [chmodDialog, setChmodDialog] = useState<FileEntry | null>(null)
    const [chmodeValue, setChmodeValue] = useState('755')
    const [chownDialog, setChownDialog] = useState<FileEntry | null>(null)
    const [chownValue, setChownValue] = useState('root:root')
    const [previewFile, setPreviewFile] = useState<{ file: FileEntry, remotePath: string } | null>(null)

    const checkWatchStatus = useCallback(async () => {
        const active = await window.api.watcherActive(localPath)
        setIsWatching(active)
    }, [localPath])

    useEffect(() => {
        checkWatchStatus()
    }, [checkWatchStatus])

    useEffect(() => {
        const cleanup = window.api.onRemoteEditStatus((data) => {
            if (data.status === 'uploaded') {
                toast.success(`Automatically uploaded: ${data.path.split('/').pop()}`, {
                    description: 'Changes detected and synced'
                })
            } else if (data.status === 'error') {
                toast.error(`Auto-upload failed for ${data.path.split('/').pop()}`, {
                    description: data.error
                })
            }
        })
        return cleanup
    }, [])

    async function toggleWatch() {
        if (isWatching) {
            await window.api.watcherStop(localPath)
            setIsWatching(false)
            toast.info('Stopped watching for changes')
        } else {
            await window.api.watcherStart(localPath, remotePath)
            setIsWatching(true)
            toast.success('Scanning and watching local changes...')
        }
    }

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
        const localFilePath = localPath === '/' ? `/${file.name}` : `${localPath}/${file.name}`
        const remoteFilePath = (remotePath.endsWith('/') ? remotePath : remotePath + '/') + file.name
        const normalizedRemotePath = remoteFilePath.replace(/\/+/g, '/')

        try {
            await window.api.transferAdd({
                type: 'upload',
                localPath: localFilePath,
                remotePath: normalizedRemotePath,
                fileName: file.name,
                totalSize: file.size,
                isDirectory: file.isDirectory
            })
            toast.info(`Queued upload: ${file.name}`)
        } catch (err) {
            toast.error('Failed to queue upload')
        }
    }

    async function handleDownload(file: FileEntry) {
        const localFilePath = localPath === '/' ? `/${file.name}` : `${localPath}/${file.name}`
        const remoteFilePath = (remotePath.endsWith('/') ? remotePath : remotePath + '/') + file.name
        const normalizedRemotePath = remoteFilePath.replace(/\/+/g, '/')

        try {
            await window.api.transferAdd({
                type: 'download',
                localPath: localFilePath,
                remotePath: normalizedRemotePath,
                fileName: file.name,
                totalSize: file.size,
                isDirectory: file.isDirectory
            })
            toast.info(`Queued download: ${file.name}`)
        } catch (err) {
            toast.error('Failed to queue download')
        }
    }

    async function handleRemoteDrop(files: FileList) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const localFilePath = (file as ElectronFile).path
            if (!localFilePath) continue

            const remoteFilePath = remotePath === '/' ? `/${file.name}` : `${remotePath}/${file.name}`

            try {
                await window.api.transferAdd({
                    type: 'upload',
                    localPath: localFilePath,
                    remotePath: remoteFilePath,
                    fileName: file.name,
                    totalSize: file.size,
                    isDirectory: false // Files from drop are always files initially for now
                })
            } catch (err) {
                console.error('Failed to queue drop upload:', file.name)
            }
        }
        toast.info(`Queued ${files.length} file(s) for upload`)
    }

    async function handleRemoteCmd(cmd: string, successMsg: string) {
        try {
            toast.loading('Executing...', { id: 'remote-cmd' })
            await window.api.remoteExecCommand(cmd)
            toast.success(successMsg, { id: 'remote-cmd' })
            // We need a way to trigger a refresh of the remote list so we don't have to manually.
            // But we don't have a direct refresh trigger exported from FileList, so we'll just 
            // set remotePath to itself to force a re-render. Wait, path equality won't trigger.
            // Actually, we can just let the user press Refresh for now.
        } catch (err) {
            toast.error(`Operation failed: ${err}`, { id: 'remote-cmd' })
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
                />
            </div>
            <div className="flex-1 min-w-0">
                <FileList
                    title="Remote"
                    icon={Server}
                    path={remotePath}
                    onPathChange={setRemotePath}
                    loadFiles={(p) => window.api.remoteList(p)}
                    onTransfer={handleDownload}
                    onDropFiles={handleRemoteDrop}
                    showHiddenFiles={settings.showHiddenFiles}
                    onPreview={(file, remotePath) => setPreviewFile({ file, remotePath })}
                    onEdit={(remotePath) => setEditingFile(remotePath)}
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

                    {!contextMenu.file.isDirectory && contextMenu.file.name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|pdf)$/i) && (
                        <button
                            className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors flex items-center gap-2"
                            onClick={() => {
                                const fullPath = remotePath === '/'
                                    ? `/${contextMenu.file.name}`
                                    : `${remotePath}/${contextMenu.file.name}`
                                setPreviewFile({ file: contextMenu.file, remotePath: fullPath })
                                setContextMenu(null)
                            }}
                        >
                            <Eye className="w-4 h-4" />
                            Preview
                        </button>
                    )}

                    {!contextMenu.file.isDirectory && (
                        <button
                            className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors flex items-center gap-2"
                            onClick={async () => {
                                const fullPath = remotePath === '/'
                                    ? `/${contextMenu.file.name}`
                                    : `${remotePath}/${contextMenu.file.name}`
                                try {
                                    setContextMenu(null)
                                    toast.loading(`Opening ${contextMenu.file.name}...`, { id: 'edit-external' })
                                    await window.api.remoteEditExternal(fullPath)
                                    toast.success('App launched. MacSCP will watch for changes.', { id: 'edit-external' })
                                } catch (err) {
                                    toast.error(`Failed to launch editor: ${err}`, { id: 'edit-external' })
                                }
                            }}
                        >
                            Edit with...
                        </button>
                    )}

                    {!contextMenu.file.isDirectory && contextMenu.file.name.match(/\.(zip|tar\.gz|tgz)$/i) && (
                        <button
                            className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                            onClick={() => {
                                const file = contextMenu.file
                                setContextMenu(null)
                                let cmd = `cd "${remotePath}" && `
                                if (file.name.endsWith('.zip')) {
                                    cmd += `unzip -o "${file.name}"`
                                } else {
                                    cmd += `tar -xzf "${file.name}"`
                                }
                                handleRemoteCmd(cmd, `Extracted ${file.name}`)
                            }}
                        >
                            Extract Archive
                        </button>
                    )}

                    {contextMenu.file.isDirectory && (
                        <button
                            className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                            onClick={() => {
                                const file = contextMenu.file
                                setContextMenu(null)
                                handleRemoteCmd(`cd "${remotePath}" && zip -r "${file.name}.zip" "${file.name}"`, `Compressed ${file.name}`)
                            }}
                        >
                            Compress to .zip
                        </button>
                    )}

                    <button
                        className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors border-t border-zinc-700/50 mt-1 pt-1.5"
                        onClick={() => {
                            setChmodDialog(contextMenu.file)
                            setContextMenu(null)
                        }}
                    >
                        Change Permissions (chmod)
                    </button>

                    <button
                        className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors border-b border-zinc-700/50 mb-1 pb-1.5"
                        onClick={() => {
                            setChownDialog(contextMenu.file)
                            setContextMenu(null)
                        }}
                    >
                        Change Owner (chown)
                    </button>

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

            {/* Editor Modal */}
            {editingFile && (
                <FileEditor
                    remotePath={editingFile}
                    onClose={() => setEditingFile(null)}
                />
            )}

            {/* Media Viewer Modal */}
            {previewFile && (
                <MediaViewer
                    file={previewFile.file}
                    remotePath={previewFile.remotePath}
                    onClose={() => setPreviewFile(null)}
                    onDownload={() => {
                        handleDownload(previewFile.file)
                        setPreviewFile(null)
                    }}
                />
            )}

            {/* Modals for Chmod/Chown */}
            {chmodDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-[300px] bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl">
                        <h3 className="text-zinc-100 font-medium mb-2">Change Permissions</h3>
                        <p className="text-xs text-zinc-400 mb-4 truncate">{chmodDialog.name}</p>
                        <input
                            autoFocus
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 mb-4 focus:outline-none focus:border-blue-500"
                            value={chmodeValue}
                            onChange={(e) => setChmodeValue(e.target.value)}
                            placeholder="e.g. 755 or 644"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleRemoteCmd(`cd "${remotePath}" && chmod ${chmodDialog.isDirectory ? '-R ' : ''}${chmodeValue} "${chmodDialog.name}"`, 'Permissions updated')
                                    setChmodDialog(null)
                                } else if (e.key === 'Escape') setChmodDialog(null)
                            }}
                        />
                        <div className="flex justify-end gap-2">
                            <button className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white" onClick={() => setChmodDialog(null)}>Cancel</button>
                            <button className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded" onClick={() => {
                                handleRemoteCmd(`cd "${remotePath}" && chmod ${chmodDialog.isDirectory ? '-R ' : ''}${chmodeValue} "${chmodDialog.name}"`, 'Permissions updated')
                                setChmodDialog(null)
                            }}>Apply</button>
                        </div>
                    </div>
                </div>
            )}

            {chownDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-[300px] bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl">
                        <h3 className="text-zinc-100 font-medium mb-2">Change Owner</h3>
                        <p className="text-xs text-zinc-400 mb-4 truncate">{chownDialog.name}</p>
                        <input
                            autoFocus
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 mb-4 focus:outline-none focus:border-blue-500"
                            value={chownValue}
                            onChange={(e) => setChownValue(e.target.value)}
                            placeholder="user:group"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleRemoteCmd(`cd "${remotePath}" && chown ${chownDialog.isDirectory ? '-R ' : ''}${chownValue} "${chownDialog.name}"`, 'Owner updated')
                                    setChownDialog(null)
                                } else if (e.key === 'Escape') setChownDialog(null)
                            }}
                        />
                        <div className="flex justify-end gap-2">
                            <button className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white" onClick={() => setChownDialog(null)}>Cancel</button>
                            <button className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded" onClick={() => {
                                handleRemoteCmd(`cd "${remotePath}" && chown ${chownDialog.isDirectory ? '-R ' : ''}${chownValue} "${chownDialog.name}"`, 'Owner updated')
                                setChownDialog(null)
                            }}>Apply</button>
                        </div>
                    </div>
                </div>
            )}

            {/* File Editor */}
            {editingFile && (
                <FileEditor
                    remotePath={editingFile}
                    onClose={() => setEditingFile(null)}
                    onOpenExternal={async () => {
                        const path = editingFile
                        setEditingFile(null)
                        try {
                            toast.loading(`Opening ${path.split('/').pop()}...`, { id: 'edit-external' })
                            await window.api.remoteEditExternal(path)
                            toast.success('App launched. MacSCP will watch for changes.', { id: 'edit-external' })
                        } catch (err) {
                            toast.error(`Failed to launch editor: ${err}`, { id: 'edit-external' })
                        }
                    }}
                />
            )}

            <button
                onClick={toggleWatch}
                className={`fixed bottom-40 right-6 w-12 h-12 rounded-full shadow-2xl flex items-center justify-center border transition-all hover:scale-110 group z-40 ${isWatching ? 'bg-green-600 border-green-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                title={isWatching ? 'Stop Watching (Keep Remote Up-to-Date)' : 'Keep Remote Up-to-Date'}
            >
                {isWatching ? (
                    <div className="relative">
                        <Eye className="h-5 w-5" />
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                    </div>
                ) : (
                    <EyeOff className="h-5 w-5" />
                )}
            </button>

            <button
                onClick={() => setShowSync(true)}
                className="fixed bottom-24 right-6 bg-zinc-800 hover:bg-zinc-700 text-white w-12 h-12 rounded-full shadow-2xl flex items-center justify-center border border-zinc-700 transition-all hover:scale-110 group z-40"
                title="Synchronize Directories"
            >
                <RefreshCcw className="h-5 w-5 text-blue-400 group-hover:rotate-180 transition-transform duration-500" />
            </button>

            {showSync && (
                <SyncDialog
                    localDir={localPath}
                    remoteDir={remotePath}
                    onClose={() => setShowSync(false)}
                />
            )}
        </div>
    )
}
