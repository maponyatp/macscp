import { ReactNode } from 'react'
import { FolderGit2, Settings, Plus, Terminal } from 'lucide-react'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

interface ShellProps {
    children: ReactNode
    activeTab: 'manager' | 'sessions' | 'terminal' | 'settings'
    onTabChange: (tab: 'manager' | 'sessions' | 'terminal' | 'settings') => void
}

export function Shell({ children, activeTab, onTabChange }: ShellProps) {
    function cn(...inputs: (string | undefined | null | false)[]) {
        return twMerge(clsx(inputs))
    }

    const NavItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: React.ElementType, label: string }) => (
        <button
            onClick={() => onTabChange(id)}
            className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                activeTab === id
                    ? "bg-blue-500/10 text-blue-500"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            )}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    )

    return (
        <div className="flex h-screen w-full bg-[#1e1e1e] text-zinc-100">
            {/* Sidebar */}
            <aside className="w-64 border-r border-zinc-800 bg-[#191919] pt-10 pb-4 flex flex-col px-4 text-xs select-none draggable">
                <div className="mb-8 px-2 flex items-center gap-3">
                    <img src="/logo.png" alt="MacSCP Logo" className="h-8 w-8 rounded-lg shadow-lg" />
                    <h1 className="text-xl font-bold tracking-tight text-white">MacSCP</h1>
                </div>

                <div className="space-y-1">
                    <NavItem id="manager" icon={Plus} label="New Connection" />
                    <NavItem id="sessions" icon={FolderGit2} label="Saved Sessions" />
                    <NavItem id="terminal" icon={Terminal} label="Terminal" />
                </div>

                <div className="mt-auto">
                    <NavItem id="settings" icon={Settings} label="Settings" />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-[#1e1e1e] p-6 pt-12">
                {children}
            </main>
        </div>
    )
}
