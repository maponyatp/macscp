import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2, Save, Key, Lock, FolderOpen, Server, Star, Folder, Cloud, XCircle, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { SSHProfile } from '../types'

interface ConnectionManagerProps {
    onConnect: () => void
}

export function ConnectionManager({ onConnect }: ConnectionManagerProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [profiles, setProfiles] = useState<SSHProfile[]>([])
    const [authType, setAuthType] = useState<'password' | 'key'>('password')
    const [selectedFolder, setSelectedFolder] = useState<string>('All Sites')

    interface FormState extends Omit<SSHProfile, 'port'> {
        port: string
    }

    const [form, setForm] = useState<FormState>({
        id: '',
        name: '',
        host: '',
        port: '22',
        username: 'root',
        password: '',
        privateKeyPath: '',
        passphrase: '',
        folder: '',
        isFavorite: false,
        useAgent: false,
        protocol: 'sftp',
        accessKeyId: '',
        secretAccessKey: '',
        region: 'us-east-1',
        bucket: '',
        endpoint: ''
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
        // Validation changes for S3
        if (form.protocol === 's3') {
            if (!form.accessKeyId || !form.bucket) return
        } else {
            if (!form.host || !form.username) return
        }

        try {
            const profile: SSHProfile = {
                ...form,
                port: parseInt(form.port) || (form.protocol === 'sftp' ? 22 : 21),
                id: form.id || crypto.randomUUID(),
                name: form.name || (form.protocol === 's3' ? `s3://${form.bucket}` : `${form.username}@${form.host}`)
            }
            // Clean up unused fields based on protocol/auth type
            if (form.protocol === 's3') {
                delete profile.password
                delete profile.privateKeyPath
                delete profile.passphrase
                delete profile.username
            } else if (authType === 'password') {
                delete profile.privateKeyPath
                delete profile.passphrase
            } else {
                delete profile.password
            }

            await window.api.settingsSaveProfile(profile)
            await loadProfiles()
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
            password: '',
            privateKeyPath: '',
            passphrase: '',
            folder: '',
            isFavorite: false,
            useAgent: false,
            protocol: 'sftp',
            accessKeyId: '',
            secretAccessKey: '',
            region: 'us-east-1',
            bucket: '',
            endpoint: ''
        })
        setAuthType('password')
    }

    function loadProfile(profile: SSHProfile) {
        setForm({
            ...profile,
            port: String(profile.port || ''),
            password: profile.password || '',
            privateKeyPath: profile.privateKeyPath || '',
            passphrase: profile.passphrase || '',
            folder: profile.folder || '',
            isFavorite: profile.isFavorite || false,
            useAgent: profile.useAgent || false,
            protocol: profile.protocol || 'sftp',
            accessKeyId: profile.accessKeyId || '',
            secretAccessKey: profile.secretAccessKey || '',
            region: profile.region || 'us-east-1',
            bucket: profile.bucket || '',
            endpoint: profile.endpoint || ''
        })
        setAuthType(profile.privateKeyPath || profile.useAgent ? 'key' : 'password')
    }

    async function handleBrowseKey() {
        try {
            const path = await window.api.dialogSelectFile()
            if (path) {
                setForm(prev => ({ ...prev, privateKeyPath: path }))
            }
        } catch (err) {
            toast.error('Failed to select file')
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const connectPayload: Partial<SSHProfile> = {
                protocol: form.protocol
            }

            if (form.protocol === 's3') {
                connectPayload.accessKeyId = form.accessKeyId
                connectPayload.secretAccessKey = form.secretAccessKey
                connectPayload.region = form.region
                connectPayload.bucket = form.bucket
                connectPayload.endpoint = form.endpoint
            } else {
                connectPayload.host = form.host
                connectPayload.port = parseInt(form.port) || (form.protocol === 'sftp' ? 22 : 21)
                connectPayload.username = form.username

                if (authType === 'password') {
                    connectPayload.password = form.password
                } else {
                    if (form.useAgent) {
                        connectPayload.useAgent = true
                    } else {
                        connectPayload.privateKeyPath = form.privateKeyPath
                        if (form.passphrase) {
                            connectPayload.passphrase = form.passphrase
                        }
                    }
                }
            }

            await window.api.remoteConnect(connectPayload)
            onConnect()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to connect'
            setError(message)
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    const folders = ['All Sites', 'Favorites', ...new Set(profiles.map(p => p.folder).filter(Boolean) as string[])]
    const filteredProfiles = profiles.filter(p => {
        if (selectedFolder === 'All Sites') return true
        if (selectedFolder === 'Favorites') return p.isFavorite
        return p.folder === selectedFolder
    })

    return (
        <div className="flex h-[calc(100vh-40px)] items-center justify-center p-8 gap-8 font-sans">

            {/* Saved Profiles Sidebar */}
            <div className="w-[450px] h-[600px] bg-zinc-800/30 border border-zinc-700 rounded-xl overflow-hidden flex">
                {/* Folder Navigation */}
                <div className="w-40 border-r border-zinc-700 bg-zinc-900/20 flex flex-col">
                    <div className="p-3 border-b border-zinc-700 font-medium text-[10px] text-zinc-500 uppercase tracking-wider">
                        Folders
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {folders.map(f => (
                            <button
                                key={f}
                                onClick={() => setSelectedFolder(f)}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2 ${selectedFolder === f
                                    ? 'bg-zinc-700 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                                    }`}
                            >
                                {f === 'All Sites' && <Server className="h-3 w-3" />}
                                {f === 'Favorites' && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                                {f !== 'All Sites' && f !== 'Favorites' && <Folder className="h-3 w-3 text-blue-400" />}
                                <span className="truncate">{f}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Profiles List */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-3 border-b border-zinc-700 font-medium text-sm text-zinc-400 flex justify-between items-center bg-zinc-800/50">
                        <span className="truncate">{selectedFolder}</span>
                        <button onClick={resetForm} className="hover:bg-zinc-700 p-1.5 rounded-lg transition-colors text-zinc-400 hover:text-white" title="New Session">
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredProfiles.map(p => (
                            <div
                                key={p.id}
                                onClick={() => loadProfile(p)}
                                className={`p-2.5 rounded-lg text-sm cursor-pointer flex justify-between items-center group transition-all duration-200 ${form.id === p.id
                                    ? 'bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] transform translate-x-1'
                                    : 'text-zinc-300 hover:bg-zinc-700/50'
                                    }`}
                            >
                                <div className="flex items-center gap-3 truncate flex-1 pr-2">
                                    <div className={`p-1.5 rounded-md ${form.id === p.id ? 'bg-white/20' : 'bg-zinc-800 border border-zinc-700'}`}>
                                        {p.protocol === 's3' ? <Cloud className="h-3.5 w-3.5" /> : <Server className="h-3.5 w-3.5" />}
                                    </div>
                                    <div className="flex flex-col truncate">
                                        <div className="flex items-center gap-1.5 truncate">
                                            {p.isFavorite && <Star className={`h-2.5 w-2.5 flex-shrink-0 ${form.id === p.id ? 'text-white fill-white' : 'text-amber-500 fill-amber-500'}`} />}
                                            <span className="truncate font-medium">{p.name}</span>
                                        </div>
                                        <span className={`text-[10px] uppercase font-bold tracking-tight opacity-60 ${form.id === p.id ? 'text-white' : 'text-zinc-500'}`}>
                                            {p.protocol || 'sftp'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => handleDeleteProfile(p.id, e)}
                                    className={`p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-200 opacity-0 group-hover:opacity-100 transition-all ${form.id === p.id ? 'text-blue-200' : 'text-zinc-500'}`}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                        {filteredProfiles.length === 0 && (
                            <div className="text-xs text-zinc-500 text-center py-12 flex flex-col items-center gap-2">
                                <FolderOpen className="h-8 w-8 text-zinc-700" />
                                No sessions found
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Connection Form */}
            <div className="w-[450px]">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
                        <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-600/20">
                            {form.protocol === 's3' ? <Cloud className="h-5 w-5" /> : <Server className="h-5 w-5" />}
                        </div>
                        {form.id ? 'Edit Session' : 'New Session'}
                    </h2>
                    <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, isFavorite: !prev.isFavorite }))}
                        className={`p-2.5 rounded-xl border transition-all duration-300 ${form.isFavorite ? 'bg-amber-500/10 border-amber-500/50 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                        title={form.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                    >
                        <Star className={`h-5 w-5 ${form.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 rounded-2xl border border-zinc-700/50 bg-zinc-800/40 backdrop-blur-xl shadow-2xl relative overflow-hidden group/form">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-transparent opacity-0 group-hover/form:opacity-100 transition-opacity duration-1000 -z-10" />

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs mb-4 flex items-center gap-2">
                            <XCircle className="h-4 w-4" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Protocol</label>
                            <select
                                className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer hover:bg-zinc-800/80"
                                value={form.protocol}
                                onChange={e => {
                                    const newProtocol = e.target.value as 'sftp' | 'ftp' | 'ftps' | 's3'
                                    setForm({
                                        ...form,
                                        protocol: newProtocol,
                                        port: newProtocol === 'sftp' ? '22' : '21'
                                    })
                                    if (newProtocol !== 'sftp' && authType === 'key') {
                                        setAuthType('password')
                                    }
                                }}
                            >
                                <option value="sftp">SFTP (SSH File Transfer Protocol)</option>
                                <option value="ftp">FTP (Plain / Insecure)</option>
                                <option value="ftps">FTPS (FTP over TLS/SSL)</option>
                                <option value="s3">Amazon S3 (Cloud Storage)</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:bg-zinc-800/30"
                                    placeholder="e.g. Production"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Folder</label>
                                <input
                                    type="text"
                                    className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:bg-zinc-800/30"
                                    placeholder="Group Name"
                                    value={form.folder}
                                    onChange={e => setForm({ ...form, folder: e.target.value })}
                                />
                            </div>
                        </div>

                        {form.protocol === 's3' ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Access Key ID</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        value={form.accessKeyId}
                                        onChange={e => setForm({ ...form, accessKeyId: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Secret Access Key</label>
                                    <input
                                        type="password"
                                        required
                                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        value={form.secretAccessKey}
                                        onChange={e => setForm({ ...form, secretAccessKey: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Region</label>
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            value={form.region}
                                            onChange={e => setForm({ ...form, region: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Bucket Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            value={form.bucket}
                                            onChange={e => setForm({ ...form, bucket: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Custom Endpoint (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="https://s3.digitaloceanspaces.com"
                                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        value={form.endpoint}
                                        onChange={e => setForm({ ...form, endpoint: e.target.value })}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Host</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            placeholder="example.com"
                                            value={form.host}
                                            onChange={e => setForm({ ...form, host: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Port</label>
                                        <input
                                            type="number"
                                            className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            value={form.port}
                                            onChange={e => setForm({ ...form, port: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Username</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        value={form.username}
                                        onChange={e => setForm({ ...form, username: e.target.value })}
                                    />
                                </div>

                                <div className="pt-2">
                                    <div className="flex p-1 bg-zinc-900/80 rounded-xl border border-zinc-700/50 mb-4 shadow-inner">
                                        <button
                                            type="button"
                                            onClick={() => setAuthType('password')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${authType === 'password' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                        >
                                            <Lock className="h-3.5 w-3.5" /> Password
                                        </button>
                                        {form.protocol === 'sftp' && (
                                            <button
                                                type="button"
                                                onClick={() => setAuthType('key')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${authType === 'key' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                            >
                                                <Key className="h-3.5 w-3.5" /> SSH Key
                                            </button>
                                        )}
                                    </div>

                                    {authType === 'password' ? (
                                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Password</label>
                                            <input
                                                type="password"
                                                className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                                value={form.password}
                                                onChange={e => setForm({ ...form, password: e.target.value })}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <label className="flex items-center gap-3 cursor-pointer group/agent p-1">
                                                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${form.useAgent ? 'bg-blue-600 border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-zinc-900 border-zinc-700 group-hover/agent:border-zinc-500'}`}>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={form.useAgent}
                                                        onChange={e => setForm({ ...form, useAgent: e.target.checked })}
                                                    />
                                                    {form.useAgent && <div className="w-2 h-2 bg-white rounded-sm" />}
                                                </div>
                                                <span className="text-sm font-medium text-zinc-300">Use macOS SSH Agent</span>
                                            </label>

                                            {!form.useAgent && (
                                                <div className="space-y-4 pt-1">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Private Key Path</label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                className="flex-1 bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none cursor-default truncate"
                                                                placeholder="~/.ssh/id_rsa"
                                                                value={form.privateKeyPath}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={handleBrowseKey}
                                                                className="bg-zinc-700 hover:bg-zinc-600 p-2.5 rounded-xl border border-zinc-600 transition-colors shadow-lg shadow-black/20"
                                                            >
                                                                <FolderOpen className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Key Passphrase</label>
                                                        <input
                                                            type="password"
                                                            className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                                            placeholder="Optional"
                                                            value={form.passphrase}
                                                            onChange={e => setForm({ ...form, passphrase: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4 pt-8">
                        <button
                            type="button"
                            onClick={handleSaveProfile}
                            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-3 rounded-2xl transition-all border border-zinc-600 flex items-center justify-center gap-2 shadow-lg shadow-black/20 active:scale-95"
                        >
                            <Save className="h-4.5 w-4.5" /> Save
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl transition-all shadow-xl shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 active:scale-95"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                                <>
                                    <Zap className="h-4.5 w-4.5" />
                                    Connect
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes slide-in-from-top-2 {
                    from { transform: translateY(-0.5rem); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-in {
                    animation-duration: 400ms;
                    animation-fill-mode: both;
                    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
                }
            ` }} />
        </div>
    )
}
