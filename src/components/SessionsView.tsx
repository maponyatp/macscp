import { useState, useEffect } from 'react'
import { Server, Trash2, Edit2 } from 'lucide-react'
import { SSHProfile } from '../types'
import { toast } from 'sonner'

interface SessionsViewProps {
    onConnect: (profile: SSHProfile) => void
    onEdit?: (profile: SSHProfile) => void
}

export function SessionsView({ onConnect, onEdit }: SessionsViewProps) {
    const [profiles, setProfiles] = useState<SSHProfile[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadProfiles()
    }, [])

    async function loadProfiles() {
        try {
            const saved = await window.api.settingsListProfiles()
            setProfiles(saved || [])
        } catch (err) {
            console.error('Failed to load profiles', err)
            toast.error('Failed to load sessions')
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        if (!confirm('Are you sure you want to delete this session?')) return

        try {
            await window.api.settingsDeleteProfile(id)
            toast.success('Session deleted')
            loadProfiles()
        } catch (err) {
            toast.error('Failed to delete session')
        }
    }

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-zinc-100">Saved Sessions</h2>
                <div className="text-sm text-zinc-500">
                    {profiles.length} session{profiles.length !== 1 ? 's' : ''}
                </div>
            </div>

            {profiles.length === 0 && !loading && (
                <div className="text-center py-20 bg-zinc-800/20 rounded-xl border border-dashed border-zinc-700">
                    <Server className="h-10 w-10 text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-zinc-400 font-medium">No saved sessions</h3>
                    <p className="text-zinc-500 text-sm mt-1">Create a new connection to save it here.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {profiles.map(profile => (
                    <div
                        key={profile.id}
                        className="group bg-zinc-800/40 border border-zinc-700/50 hover:border-blue-500/50 hover:bg-zinc-800/80 rounded-xl p-4 transition-all cursor-pointer relative"
                        onClick={() => onConnect(profile)}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                                <Server className="h-5 w-5" />
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(profile) }}
                                    className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-zinc-100"
                                    title="Edit"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(profile.id, e)}
                                    className="p-1.5 hover:bg-red-500/10 rounded-md text-zinc-400 hover:text-red-400"
                                    title="Delete"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <h3 className="font-semibold text-zinc-100 mb-1 truncate pr-8">{profile.name}</h3>
                        <div className="text-sm text-zinc-500 font-mono truncate">
                            {profile.username}@{profile.host}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
