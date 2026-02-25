import { useState, useEffect } from 'react'
import { X, Image as ImageIcon, FileText, Loader2, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { FileEntry } from '../types'

interface MediaViewerProps {
    file: FileEntry
    remotePath: string
    onClose: () => void
    onDownload: () => void
}

export function MediaViewer({ file, remotePath, onClose, onDownload }: MediaViewerProps) {
    const [loading, setLoading] = useState(true)
    const [mediaData, setMediaData] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file.name)
    const isPdf = /\.pdf$/i.test(file.name)

    const getMimeType = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase()
        switch (ext) {
            case 'jpg':
            case 'jpeg': return 'image/jpeg'
            case 'png': return 'image/png'
            case 'gif': return 'image/gif'
            case 'webp': return 'image/webp'
            case 'svg': return 'image/svg+xml'
            case 'pdf': return 'application/pdf'
            default: return 'application/octet-stream'
        }
    }

    useEffect(() => {
        const fetchMedia = async () => {
            try {
                // Ensure we don't try to load multi-GB files into RAM
                if (file.size > 25 * 1024 * 1024) { // 25MB limit for inline preview
                    throw new Error('File is too large for inline preview (>25MB). Please download it instead.')
                }

                const base64Str = await window.api.remoteReadBuffer(remotePath)
                const mimeType = getMimeType(file.name)
                setMediaData(`data:${mimeType};base64,${base64Str}`)
            } catch (err) {
                console.error('Failed to load media', err)
                setError(err instanceof Error ? err.message : 'Failed to load preview')
                toast.error('Preview failed')
            } finally {
                setLoading(false)
            }
        }

        fetchMedia()

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [file, remotePath, onClose])

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-8"
                onClick={onClose}
            >
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-50"
                >
                    <X className="w-6 h-6" />
                </button>

                <div
                    className="max-w-6xl w-full h-full max-h-[90vh] flex flex-col items-center justify-center relative"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Top Bar Info */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none">
                        <div className="flex items-center gap-3 text-white">
                            {isImage ? <ImageIcon className="w-5 h-5 text-blue-400" /> : <FileText className="w-5 h-5 text-red-400" />}
                            <div>
                                <h3 className="font-medium text-shadow">{file.name}</h3>
                                <p className="text-xs text-white/70">{(file.size / 1024).toFixed(1)} KB • {remotePath}</p>
                            </div>
                        </div>
                        <button
                            onClick={onDownload}
                            className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-md transition-colors backdrop-blur-md border border-white/10"
                        >
                            <Download className="w-4 h-4" />
                            Download Original
                        </button>
                    </div>

                    {/* Content View */}
                    <div className="w-full h-full flex items-center justify-center p-12">
                        {loading && (
                            <div className="flex flex-col items-center gap-4 text-white/50">
                                <Loader2 className="w-10 h-10 animate-spin" />
                                <p className="text-sm font-medium tracking-wide">Loading secure stream...</p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-6 rounded-xl max-w-md text-center">
                                <X className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <h3 className="font-semibold mb-2">Preview Unavailable</h3>
                                <p className="text-sm">{error}</p>
                                <button
                                    onClick={onDownload}
                                    className="mt-6 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg text-sm transition-colors w-full"
                                >
                                    Download to Disk
                                </button>
                            </div>
                        )}

                        {!loading && !error && mediaData && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.1, duration: 0.3 }}
                                className="w-full h-full flex items-center justify-center"
                            >
                                {isImage && (
                                    <img
                                        src={mediaData}
                                        alt={file.name}
                                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
                                    />
                                )}
                                {isPdf && (
                                    <iframe
                                        src={`${mediaData}#toolbar=0`}
                                        className="w-full h-full max-w-4xl bg-zinc-900 rounded-xl shadow-2xl ring-1 ring-white/10"
                                        title={file.name}
                                    />
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
