import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'

interface FileEditorProps {
    remotePath: string
    onClose: () => void
}

export function FileEditor({ remotePath, onClose }: FileEditorProps) {
    const [content, setContent] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Load file content on mount
    useState(() => {
        loadFile()
    })

    async function loadFile() {
        try {
            setLoading(true)
            const fileContent = await window.api.sshReadFile(remotePath)
            setContent(fileContent)
        } catch (error) {
            toast.error(`Failed to load file: ${error}`)
            onClose()
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        try {
            setSaving(true)
            await window.api.sshWriteFile(remotePath, content)
            toast.success('File saved successfully')
        } catch (error) {
            toast.error(`Failed to save file: ${error}`)
        } finally {
            setSaving(false)
        }
    }

    const fileName = remotePath.split('/').pop() || 'Untitled'

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-[90vw] h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <div>
                        <h2 className="text-lg font-semibold text-white">{fileName}</h2>
                        <p className="text-sm text-zinc-400">{remotePath}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-md text-sm font-medium transition-colors"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
                        >
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* Editor */}
                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-zinc-400">Loading file...</div>
                        </div>
                    ) : (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-full bg-zinc-950 text-zinc-100 p-4 font-mono text-sm resize-none focus:outline-none"
                            spellCheck={false}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-zinc-800 text-xs text-zinc-500">
                    Press Cmd+S to save • {content.split('\n').length} lines
                </div>
            </div>
        </div>
    )
}
