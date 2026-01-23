import { useState, useEffect, useCallback } from 'react'
import { X, Save, Loader2, FileText, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface FileEditorProps {
    remotePath: string
    onClose: () => void
    onOpenExternal?: () => void
}

export function FileEditor({ remotePath, onClose, onOpenExternal }: FileEditorProps) {
    const [content, setContent] = useState('')
    const [initialContent, setInitialContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isDirty, setIsDirty] = useState(false)

    const fileName = remotePath.split('/').pop() || remotePath

    const loadFile = useCallback(async () => {
        try {
            setLoading(true)
            const data = await window.api.remoteReadFile(remotePath)
            setContent(data)
            setInitialContent(data)
            setIsDirty(false)
        } catch (err) {
            toast.error(`Failed to load file: ${err}`)
            onClose()
        } finally {
            setLoading(false)
        }
    }, [remotePath, onClose])

    useEffect(() => {
        loadFile()
    }, [loadFile])

    const handleSave = async () => {
        if (!isDirty || saving) return
        setSaving(true)
        try {
            await window.api.remoteWriteFile(remotePath, content)
            setInitialContent(content)
            setIsDirty(false)
            toast.success('File saved to server')
        } catch (err) {
            toast.error(`Failed to save: ${err}`)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    <span className="text-sm font-medium text-zinc-400">Loading {fileName}...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-700 w-full max-w-4xl h-full max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-blue-500/10 rounded-lg">
                            <FileText className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-100">{fileName}</span>
                            <span className="text-[10px] text-zinc-500 truncate max-w-[400px]">{remotePath}</span>
                        </div>
                        {isDirty && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-1" title="Unsaved changes" />
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {onOpenExternal && (
                            <button
                                onClick={onOpenExternal}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Edit with...
                            </button>
                        )}
                        <div className="w-px h-4 bg-zinc-800 mx-1" />
                        <button
                            onClick={handleSave}
                            disabled={saving || !isDirty}
                            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${isDirty
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 active:scale-95'
                                : 'bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed'
                                }`}
                        >
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Save
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 min-h-0 bg-zinc-950/50 relative">
                    <textarea
                        value={content}
                        onChange={(e) => {
                            setContent(e.target.value)
                            setIsDirty(e.target.value !== initialContent)
                        }}
                        autoFocus
                        spellCheck={false}
                        className="w-full h-full bg-transparent text-zinc-300 p-6 font-mono text-sm resize-none focus:outline-none focus:ring-0 leading-relaxed custom-scrollbar selection:bg-blue-500/30"
                        placeholder="Loading file content..."
                    />
                </div>

                {/* Footer Info */}
                <div className="h-8 border-t border-zinc-800 bg-zinc-900/50 px-4 flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                    <div className="flex items-center gap-4">
                        <span>Lines: {content.split('\n').length}</span>
                        <span>Characters: {content.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {saving && <span className="flex items-center gap-1.5"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving...</span>}
                        {!saving && isDirty && <span className="text-amber-500/80">Unsaved changes</span>}
                        {!saving && !isDirty && <span className="text-emerald-500/80 tracking-tight">Saved to server</span>}
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 10px;
                    height: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                    border: 2px solid transparent;
                    background-clip: content-box;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.1);
                    background-clip: content-box;
                }
            ` }} />
        </div>
    )
}
