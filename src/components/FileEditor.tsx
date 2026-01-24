import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Save, Loader2, FileText, ExternalLink, Code2 } from 'lucide-react'
import { toast } from 'sonner'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface FileEditorProps {
    remotePath: string
    onClose: () => void
    onOpenExternal?: () => void
}

const EXT_TO_LANG: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'php': 'php',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
}

export function FileEditor({ remotePath, onClose, onOpenExternal }: FileEditorProps) {
    const [content, setContent] = useState('')
    const [initialContent, setInitialContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isDirty, setIsDirty] = useState(false)
    const [mode, setMode] = useState<'edit' | 'preview'>('edit')

    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const fileName = remotePath.split('/').pop() || remotePath
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    const language = EXT_TO_LANG[extension] || 'text'

    const handleClose = () => {
        if (isDirty) {
            if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
                return
            }
        }
        onClose()
    }

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

    // Handle tab key in textarea
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault()
            const start = e.currentTarget.selectionStart
            const end = e.currentTarget.selectionEnd

            const newContent = content.substring(0, start) + '    ' + content.substring(end)
            setContent(newContent)
            setIsDirty(newContent !== initialContent)

            // Set cursor position after update
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4
                }
            }, 0)
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
            <div className="bg-zinc-900 border border-zinc-700 w-full max-w-5xl h-full max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <FileText className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-zinc-100">{fileName}</span>
                                {language !== 'text' && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-md font-mono uppercase tracking-wider">
                                        {language}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] text-zinc-500 truncate max-w-[400px] font-mono">{remotePath}</span>
                        </div>
                        {isDirty && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-1" title="Unsaved changes" />
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Mode Toggle */}
                        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 mr-2">
                            <button
                                onClick={() => setMode('edit')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'edit' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => setMode('preview')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'preview' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Preview
                            </button>
                        </div>

                        {onOpenExternal && (
                            <button
                                onClick={onOpenExternal}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors group"
                            >
                                <ExternalLink className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
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
                            onClick={handleClose}
                            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 min-h-0 bg-zinc-950/80 relative overflow-hidden group">
                    {mode === 'edit' ? (
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => {
                                setContent(e.target.value)
                                setIsDirty(e.target.value !== initialContent)
                            }}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            spellCheck={false}
                            className="w-full h-full bg-transparent text-zinc-300 p-6 font-mono text-sm resize-none focus:outline-none focus:ring-0 leading-relaxed custom-scrollbar selection:bg-blue-500/30 whitespace-pre z-0"
                            placeholder="Type code here..."
                        />
                    ) : (
                        <div className="w-full h-full overflow-auto custom-scrollbar">
                            <SyntaxHighlighter
                                language={language}
                                style={vscDarkPlus}
                                showLineNumbers={true}
                                lineNumberStyle={{ minWidth: '3.5em', paddingRight: '1em', color: '#4b5563', textAlign: 'right', userSelect: 'none' }}
                                customStyle={{
                                    margin: 0,
                                    padding: '1.5rem',
                                    backgroundColor: 'transparent',
                                    fontSize: '0.875rem',
                                    lineHeight: '1.625',
                                    height: 'auto',
                                    minHeight: '100%',
                                }}
                            >
                                {content || ' '}
                            </SyntaxHighlighter>
                        </div>
                    )}

                    {/* Floating Indicator */}
                    <div className="absolute top-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur px-2 py-1 rounded border border-zinc-800 shadow-xl">
                            <Code2 className="h-3 w-3 text-zinc-500" />
                            <span className="text-[10px] text-zinc-500 font-mono italic">
                                {mode === 'edit' ? 'Editing Mode' : 'Syntax Highlighted'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="h-10 border-t border-zinc-800 bg-zinc-900/50 px-4 flex items-center justify-between text-[10px] text-zinc-500 font-medium tracking-tight">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1.5">
                            <span className="text-zinc-600">LN</span>
                            <span className="text-zinc-400">{content.split('\n').length}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-zinc-600">CH</span>
                            <span className="text-zinc-400">{content.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5 uppercase font-bold">
                            <span className="text-zinc-600">LANG</span>
                            <span className="text-blue-500/80">{language}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {saving && <span className="flex items-center gap-1.5 text-blue-400"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Syncing with server...</span>}
                        {!saving && isDirty && <span className="text-amber-500/80 flex items-center gap-1">● Unsaved changes</span>}
                        {!saving && !isDirty && <span className="text-emerald-500/80 flex items-center gap-1">✓ Synced</span>}
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
                
                /* Prism code font consistency */
                pre code {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
                }
            ` }} />
        </div>
    )
}
