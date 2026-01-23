import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'

import { SSHProfile } from '../types'

interface ConnectionManagerProps {
    onConnect: () => void
}

export function ConnectionManager({ onConnect }: ConnectionManagerProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [profiles, setProfiles] = useState<SSHProfile[]>([])
    const [form, setForm] = useState<Omit<SSHProfile, 'port'> & { port: string }>({
        id: '',
        name: '',
        host: '',
        port: '22',
        username: 'root',
        password: ''
    })

    useEffect(() => {
        loadProfiles()
    }, [])

    async function loadProfiles() {
        try {
            const saved = await window.api.settingsListProfiles()
            setProfiles(saved || [])
        } catch (err) {
            console.error('Failed to load profiles', err)
        }
    }

    async function handleSaveProfile() {
        if (!form.host || !form.username) return

        try {
            const profile: SSHProfile = {
                ...form,
                port: parseInt(form.port) || 22,
                id: form.id || crypto.randomUUID(),
                name: form.name || `${form.username}@${form.host}`
            }
            await window.api.settingsSaveProfile(profile)
            await loadProfiles()
            // Update form with saved ID if it was new
            setForm(prev => ({ ...prev, id: profile.id, name: profile.name }))
            toast.success('Session saved')
        } catch (err) {
            console.error('Failed to save', err)
            toast.error('Failed to save session')
        }
    }

    async function handleDeleteProfile(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        if (!confirm('Delete this profile?')) return
        try {
            await window.api.settingsDeleteProfile(id)
            await loadProfiles()
            if (form.id === id) {
                resetForm()
            }
            toast.success('Session deleted')
        } catch (err) {
            console.error('Failed to delete', err)
            toast.error('Failed to delete session')
        }
    }

    function resetForm() {
        setForm({
            id: '',
            name: '',
            host: '',
            port: '22',
            username: 'root',
            password: ''
        })
    }

    function loadProfile(profile: SSHProfile) {
        setForm({
            ...profile,
            port: String(profile.port),
            password: profile.password || ''
        })
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            await window.api.sshConnect({
                host: form.host,
                port: parseInt(form.port) || 22,
                username: form.username,
                password: form.password
            })
            onConnect()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to connect'
            setError(message)
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex h-[calc(100vh-40px)] items-center justify-center p-8 gap-8">

            {/* Saved Profiles Sidebar */}
            <div className="w-56 h-[420px] bg-zinc-800/30 border border-zinc-700 rounded-xl overflow-hidden flex flex-col">
                <div className="p-3 border-b border-zinc-700 font-medium text-sm text-zinc-400 flex justify-between items-center">
                    <span>Saved Sessions</span>
                    <button onClick={resetForm} className="hover:bg-zinc-700 p-1 rounded">
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {profiles.map(p => (
                        <div
                            key={p.id}
                            onClick={() => loadProfile(p)}
                            className={`p-2 rounded text-sm cursor-pointer flex justify-between items-center group ${form.id === p.id
                                ? 'bg-blue-600 text-white'
                                : 'text-zinc-300 hover:bg-zinc-700'
                                }`}
                        >
                            <span className="truncate flex-1">{p.name}</span>
                            <button
                                onClick={(e) => handleDeleteProfile(p.id, e)}
                                className={`p-1 rounded hover:bg-red-500/20 hover:text-red-200 opacity-0 group-hover:opacity-100 ${form.id === p.id ? 'text-blue-200' : 'text-zinc-500'}`}
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    {profiles.length === 0 && (
                        <div className="text-xs text-zinc-500 text-center py-4">No saved profiles</div>
                    )}
                </div>
            </div>

            {/* Connection Form */}
            <div className="w-[400px]">
                <h2 className="text-2xl font-bold mb-6">Connect to Server</h2>

                <form onSubmit={handleSubmit} className="p-6 rounded-xl border border-zinc-700 bg-zinc-800/50 backdrop-blur-sm space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-400">Session Name (Optional)</label>
                        <input
                            type="text"
                            className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            placeholder="e.g. My VPS"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1">
                            <label className="text-xs font-medium text-zinc-400">Host</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="example.com"
                                value={form.host}
                                onChange={e => setForm({ ...form, host: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-400">Port</label>
                            <input
                                type="number"
                                className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                value={form.port}
                                onChange={e => setForm({ ...form, port: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-400">Username</label>
                        <input
                            type="text"
                            className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            value={form.username}
                            onChange={e => setForm({ ...form, username: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-400">Password</label>
                        <input
                            type="password"
                            className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleSaveProfile}
                            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Save className="h-4 w-4" /> Save
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
