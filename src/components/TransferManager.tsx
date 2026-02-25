import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Clock, ArrowUpRight, ArrowDownLeft, X, Trash2, Zap, RotateCcw, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TransferTask } from '../types'

export function TransferManager() {
    const [queue, setQueue] = useState<TransferTask[]>([])
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        window.api.transferGetQueue().then(setQueue)
        return window.api.onTransferQueueUpdate(setQueue)
    }, [])

    const activeCount = queue.filter(t => t.status === 'active' || t.status === 'pending').length
    const failedOrInterruptedCount = queue.filter(t => t.status === 'failed' || t.status === 'interrupted' || t.status === 'cancelled').length

    if (queue.length === 0) return null

    function formatSize(bytes: number) {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    function formatSpeed(bps: number) {
        return formatSize(bps) + '/s'
    }

    return (
        <div className="fixed bottom-12 right-6 z-50 flex flex-col items-end gap-2">
            {/* Summary Bubble */}
            <AnimatePresence>
                {!isOpen && activeCount > 0 && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => setIsOpen(true)}
                        className="bg-blue-600/90 hover:bg-blue-500 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.3)] flex items-center gap-2 transition-all border border-white/10"
                    >
                        <Zap className="h-4 w-4 fill-white" />
                        <span className="text-sm font-medium">{activeCount} active transfer{activeCount > 1 ? 's' : ''}</span>
                    </motion.button>
                )}

                {!isOpen && activeCount === 0 && queue.length > 0 && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => setIsOpen(true)}
                        className="bg-zinc-800/80 hover:bg-zinc-700/80 backdrop-blur-md text-zinc-300 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all border border-white/5"
                    >
                        {failedOrInterruptedCount > 0 ? (
                            <RotateCcw className="h-4 w-4 text-amber-500" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        <span className="text-sm font-medium">
                            {failedOrInterruptedCount > 0 ? `${failedOrInterruptedCount} task(s) to resume` : 'Transfers complete'}
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Expanded Queue */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="w-[400px] bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        <div className="p-3 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                                <Zap className="h-4 w-4 text-blue-400" />
                                Transfers
                            </div>
                            <div className="flex items-center gap-2">
                                {failedOrInterruptedCount > 0 && (
                                    <button
                                        onClick={() => window.api.transferRetryAll()}
                                        className="p-1.5 hover:bg-zinc-700 rounded-md text-amber-500 hover:text-amber-400"
                                        title="Resume All"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => window.api.transferClearCompleted()}
                                    className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-zinc-200"
                                    title="Clear non-active"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-zinc-200"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            <AnimatePresence>
                                {queue.map(task => (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                        key={task.id}
                                        className="bg-zinc-800/40 border border-white/5 rounded-xl p-3 space-y-2 group hover:bg-zinc-800/60 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <div className={`mt-0.5 p-1.5 rounded-md ${task.type === 'upload' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                                                    {task.type === 'upload' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-medium text-zinc-200 truncate" title={task.fileName}>
                                                        {task.fileName}
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                                                        {task.type === 'upload' ? 'To: ' : 'From: '} {task.remotePath}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {(task.status === 'failed' || task.status === 'cancelled' || task.status === 'interrupted') && (
                                                    <button
                                                        onClick={() => window.api.transferRetryTask(task.id)}
                                                        className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded transition-all"
                                                        title={task.status === 'interrupted' ? 'Resume' : 'Retry'}
                                                    >
                                                        {task.status === 'interrupted' ? <Play className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                                    </button>
                                                )}
                                                {task.status === 'active' && (
                                                    <button
                                                        onClick={() => window.api.transferCancel(task.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-all"
                                                        title="Cancel"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-zinc-400">
                                                <span className='flex items-center gap-1'>
                                                    {task.status === 'pending' && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {task.retryCount && task.retryCount > 0 ? `Retrying (${task.retryCount}/3)...` : 'Pending'}
                                                        </span>
                                                    )}
                                                    {task.status === 'active' && <span>{formatSize(task.transferredSize)} of {formatSize(task.totalSize)}</span>}
                                                    {task.status === 'completed' && <span className='text-green-500'>Completed</span>}
                                                    {task.status === 'failed' && <span className='text-red-500 font-medium' title={task.error}>Failed</span>}
                                                    {task.status === 'cancelled' && <span className='text-zinc-500'>Cancelled</span>}
                                                    {task.status === 'interrupted' && <span className='text-amber-500'>Interrupted ({Math.round((task.transferredSize / task.totalSize) * 100)}%)</span>}
                                                </span>
                                                {task.status === 'active' && <span>{formatSpeed(task.speed)}</span>}
                                            </div>

                                            {(task.status === 'active' || task.status === 'completed' || task.status === 'interrupted') && (
                                                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-300 ${task.status === 'completed' ? 'bg-green-500' : task.status === 'interrupted' ? 'bg-amber-600' : 'bg-blue-500'}`}
                                                        style={{ width: `${task.progress || (task.transferredSize / task.totalSize * 100)}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
