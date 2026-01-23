import { useState } from 'react'
import { Lock, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

interface MasterPasswordModalProps {
    onUnlock: () => void
}

export function MasterPasswordModal({ onUnlock }: MasterPasswordModalProps) {
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!password.trim()) return

        setLoading(true)
        setError(null)
        try {
            const success = await window.api.encryptionSet(password)
            if (success) {
                toast.success('MacSCP Unlocked')
                onUnlock()
            }
        } catch (err) {
            setError('System error setting master password')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 pb-4 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 ring-4 ring-blue-500/5">
                        <Lock className="h-8 w-8 text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Master Password Required</h2>
                    <p className="text-zinc-400 text-sm max-w-[280px]">
                        Enter your master password to decrypt your saved session credentials.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-500 text-sm">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="relative group">
                            <input
                                autoFocus
                                type="password"
                                className="w-full bg-zinc-950/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono"
                                placeholder="••••••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                                <ShieldCheck className="h-4 w-4 text-blue-400" />
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 px-1">
                            Tip: Your master password is never stored and is used to derive an encryption key locally.
                        </p>
                    </div>

                    <button
                        disabled={loading || !password.trim()}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group"
                    >
                        {loading ? (
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Unlock MacSCP
                                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => toast.info('Resetting requires clearing your profiles.json manually for now.')}
                            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                            Forgot master password?
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
