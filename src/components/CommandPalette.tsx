import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { Server, Settings, Terminal, Zap, Trash2, Folder, Search, Activity } from 'lucide-react'
import { SSHProfile } from '../types'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'

interface CommandPaletteProps {
    profiles: SSHProfile[]
    onConnect: (profile: SSHProfile) => void
    onNavigate: (tab: 'manager' | 'sessions' | 'terminal' | 'dashboard' | 'settings') => void
}

export function CommandPalette({ profiles, onConnect, onNavigate }: CommandPaletteProps) {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    const runCommand = (command: () => void) => {
        setOpen(false)
        command()
    }

    if (!open) return null

    return (
        <Command.Dialog
            open={open}
            onOpenChange={setOpen}
            label="Global Command Menu"
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div className="w-full max-w-xl bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="flex items-center border-b border-white/5 px-4" cmdk-input-wrapper="">
                    <Search className="h-5 w-5 text-zinc-500 mr-2" />
                    <Command.Input
                        autoFocus
                        placeholder="Type a command or search sessions..."
                        className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 py-4 focus:outline-none"
                    />
                    <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-400 opacity-100">
                        <span className="text-xs">ESC</span>
                    </kbd>
                </div>

                <Command.List className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
                    <Command.Empty className="py-6 text-center text-sm text-zinc-500">
                        No results found.
                    </Command.Empty>

                    <Command.Group heading="Saved Sessions" className="text-xs font-medium text-zinc-500 px-2 py-1.5">
                        {profiles.map(profile => (
                            <Command.Item
                                key={profile.id}
                                onSelect={() => runCommand(() => onConnect(profile))}
                                className={twMerge(
                                    "flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-lg cursor-pointer transition-colors",
                                    "data-[selected='true']:bg-blue-600/20 data-[selected='true']:text-blue-400"
                                )}
                            >
                                <Server className="h-4 w-4" />
                                <span className="flex-1 truncate">{profile.name}</span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                    {profile.username}@{profile.host}
                                </span>
                            </Command.Item>
                        ))}
                    </Command.Group>

                    <Command.Group heading="Navigation" className="text-xs font-medium text-zinc-500 px-2 py-1.5 mt-2">
                        <Command.Item
                            onSelect={() => runCommand(() => onNavigate('manager'))}
                            className={twMerge(
                                "flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-lg cursor-pointer transition-colors",
                                "data-[selected='true']:bg-zinc-800 data-[selected='true']:text-white"
                            )}
                        >
                            <Folder className="h-4 w-4 text-zinc-400" />
                            File Explorer
                        </Command.Item>
                        <Command.Item
                            onSelect={() => runCommand(() => onNavigate('terminal'))}
                            className={twMerge(
                                "flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-lg cursor-pointer transition-colors",
                                "data-[selected='true']:bg-zinc-800 data-[selected='true']:text-white"
                            )}
                        >
                            <Terminal className="h-4 w-4 text-zinc-400" />
                            Terminal Dashboard
                        </Command.Item>
                        <Command.Item
                            onSelect={() => runCommand(() => onNavigate('dashboard'))}
                            className={twMerge(
                                "flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-lg cursor-pointer transition-colors",
                                "data-[selected='true']:bg-zinc-800 data-[selected='true']:text-white"
                            )}
                        >
                            <Activity className="h-4 w-4 text-zinc-400" />
                            Server Health Dashboard
                        </Command.Item>
                        <Command.Item
                            onSelect={() => runCommand(() => onNavigate('settings'))}
                            className={twMerge(
                                "flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-lg cursor-pointer transition-colors",
                                "data-[selected='true']:bg-zinc-800 data-[selected='true']:text-white"
                            )}
                        >
                            <Settings className="h-4 w-4 text-zinc-400" />
                            Preferences
                        </Command.Item>
                    </Command.Group>

                    <Command.Group heading="Actions" className="text-xs font-medium text-zinc-500 px-2 py-1.5 mt-2">
                        <Command.Item
                            onSelect={() => runCommand(() => {
                                window.api.transferClearCompleted()
                                toast.success("Cleared completed transfers")
                            })}
                            className={twMerge(
                                "flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-lg cursor-pointer transition-colors",
                                "data-[selected='true']:bg-zinc-800 data-[selected='true']:text-white"
                            )}
                        >
                            <Trash2 className="h-4 w-4 text-zinc-400" />
                            Clear Completed Transfers
                        </Command.Item>
                        <Command.Item
                            onSelect={() => runCommand(() => {
                                window.api.transferRetryAll()
                                toast.success("Resuming all paused/failed transfers")
                            })}
                            className={twMerge(
                                "flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-lg cursor-pointer transition-colors",
                                "data-[selected='true']:bg-zinc-800 data-[selected='true']:text-white"
                            )}
                        >
                            <Zap className="h-4 w-4 text-zinc-400" />
                            Resume All Failed Transfers
                        </Command.Item>
                    </Command.Group>
                </Command.List>
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                [cmdk-group-heading] {
                    color: #71717a;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    padding-bottom: 4px;
                }
            `}} />
        </Command.Dialog>
    )
}
