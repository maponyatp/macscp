import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ArrowRight, ArrowLeft, Check, X } from 'lucide-react'
import { SyncDiff } from '../vite-env'
import { toast } from 'sonner'

interface SyncDialogProps {
    localDir: string
    remoteDir: string
    onClose: () => void
}

export function SyncDialog({ localDir, remoteDir, onClose }: SyncDialogProps) {
    const [diffs, setDiffs] = useState<SyncDiff[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    const compare = useCallback(async () => {
        setLoading(true)
        try {
            const results = await window.api.syncCompare(localDir, remoteDir)
            const filtering = results.filter(d => d.status !== 'same')
            setDiffs(filtering)
            setSelected(new Set(filtering.map(d => d.name)))
        } catch (err) {
            toast.error('Comparison failed')
            onClose()
        } finally {
            setLoading(false)
        }
    }, [localDir, remoteDir, onClose])

    useEffect(() => {
        compare()
    }, [compare])

    function toggleSelect(name: string) {
        const next = new Set(selected)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        setSelected(next)
    }

    async function handleSync() {
        const tasks = diffs.filter(d => selected.has(d.name))

        for (const task of tasks) {
            try {
                if (task.status === 'only-local' || task.status === 'newer-local') {
                    await window.api.transferAdd({
                        type: 'upload',
                        localPath: task.localPath,
                        remotePath: task.remotePath,
                        fileName: task.name,
                        totalSize: task.localSize || 0
                    })
                } else if (task.status === 'only-remote' || task.status === 'newer-remote') {
                    await window.api.transferAdd({
                        type: 'download',
                        localPath: task.localPath,
                        remotePath: task.remotePath,
                        fileName: task.name,
                        totalSize: task.remoteSize || 0
                    })
                }
            } catch (err) {
                console.error('Failed to queue sync task:', task.name)
            }
        }

        toast.success(`Queued ${tasks.length} tasks for sync`)
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-8 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 shadow-2xl rounded-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-zinc-700 flex justify-between items-center bg-zinc-800/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-500/10 p-2 rounded-lg">
                            <RefreshCw className={`h-5 w-5 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Synchronize Directories</h3>
                            <p className="text-xs text-zinc-500 font-mono truncate max-w-[400px]">
                                {localDir} ↔ {remoteDir}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="h-40 flex flex-col items-center justify-center gap-3 text-zinc-500">
                            <RefreshCw className="h-8 w-8 animate-spin" />
                            <p className="text-sm">Comparing files...</p>
                        </div>
                    ) : diffs.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center gap-3 text-zinc-500">
                            <Check className="h-10 w-10 text-green-500" />
                            <p className="text-sm">Directories are already in sync!</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold text-zinc-500 px-2 pb-2">
                                <span>File Difference</span>
                                <span>Action</span>
                            </div>
                            {diffs.map(diff => (
                                <div
                                    key={diff.name}
                                    onClick={() => toggleSelect(diff.name)}
                                    className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${selected.has(diff.name)
                                        ? 'bg-blue-500/5 border-blue-500/20'
                                        : 'bg-zinc-800/30 border-zinc-700/50 grayscale'
                                        }`}
                                >
                                    <div className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${selected.has(diff.name) ? 'bg-blue-600 border-blue-600' : 'border-zinc-600'
                                        }`}>
                                        {selected.has(diff.name) && <Check className="h-3 w-3 text-white" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{diff.name}</div>
                                        <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-2">
                                            {diff.status === 'only-local' && <span className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">LOCAL ONLY</span>}
                                            {diff.status === 'only-remote' && <span className="text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">REMOTE ONLY</span>}
                                            {diff.status === 'newer-local' && <span className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">NEWER LOCAL</span>}
                                            {diff.status === 'newer-remote' && <span className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">NEWER REMOTE</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {(diff.status === 'only-local' || diff.status === 'newer-local') ? (
                                            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                                                <span>Upload</span>
                                                <ArrowRight className="h-4 w-4" />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs font-semibold text-green-400">
                                                <ArrowLeft className="h-4 w-4" />
                                                <span>Download</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-700 flex justify-between items-center bg-zinc-800/50 rounded-b-2xl">
                    <div className="text-xs text-zinc-500">
                        {selected.size} of {diffs.length} differences selected
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={selected.size === 0 || loading}
                            onClick={handleSync}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                        >
                            Sync Selected
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
