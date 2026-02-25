import { useState, useEffect, useCallback } from 'react'
import { Activity, Server, HardDrive, Cpu, Clock, RefreshCw, Terminal, Network, List } from 'lucide-react'

// Simple Circular Progress component
const CircularProgress = ({ value, label, colorClass }: { value: number, label: string, colorClass: string }) => {
    const radius = 36
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (value / 100) * circumference

    return (
        <div className="flex flex-col items-center justify-center gap-2">
            <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="48"
                        cy="48"
                        r={radius}
                        className="stroke-zinc-800 fill-none"
                        strokeWidth="8"
                    />
                    <circle
                        cx="48"
                        cy="48"
                        r={radius}
                        className={`fill-none transition-all duration-1000 ease-out ${colorClass}`}
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-xl font-bold text-zinc-100">{Math.round(value)}%</span>
                </div>
            </div>
            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{label}</span>
        </div>
    )
}

interface ServerMetrics {
    uptime: string
    cpuLoad: number
    memTotal: string
    memUsedRatio: number
    diskTotal: string
    diskUsedRatio: number
}

interface ProcessInfo {
    pid: string
    cmd: string
    mem: string
    cpu: string
}

export function ServerDashboard() {
    const [metrics, setMetrics] = useState<ServerMetrics | null>(null)
    const [processes, setProcesses] = useState<ProcessInfo[]>([])
    const [networkInfo, setNetworkInfo] = useState<string>('')
    const [sysLogs, setSysLogs] = useState<string>('')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchMetrics = useCallback(async () => {
        try {
            // 1. Uptime & Load
            const uptimeRaw = await window.api.remoteExecCommand('uptime')

            // Basic parsing for: " 14:02  up  1:23, 2 users, load averages: 2.15 1.83 1.76"
            const loadMatch = uptimeRaw.match(/average[s]?:\s+([\d.]+)/)
            const cpuLoad = loadMatch ? parseFloat(loadMatch[1]) * 10 : 0 // Rough % representation for UI demo

            const uptimeMatch = uptimeRaw.match(/up\s+(.*?),\s+\d+\s+user/)
            const uptime = uptimeMatch ? uptimeMatch[1] : 'Unknown'

            // 2. Memory (free -m doesn't work on macOS, so we'll do a basic cross-platform fallback or just parse linux free)
            let memUsedRatio = 0
            let memTotal = 'Unknown'
            try {
                const freeRaw = await window.api.remoteExecCommand('free -m')
                const memMatch = freeRaw.match(/Mem:\s+(\d+)\s+(\d+)/)
                if (memMatch) {
                    const total = parseInt(memMatch[1])
                    const used = parseInt(memMatch[2])
                    memUsedRatio = (used / total) * 100
                    memTotal = `${(total / 1024).toFixed(1)} GB`
                }
            } catch (e) {
                // macOS doesn't have `free` by default, fallback gracefully if targeting mac servers
                console.warn('Could not parse free command', e)
            }

            // 3. Disk Space
            let diskUsedRatio = 0
            let diskTotal = 'Unknown'
            try {
                const dfRaw = await window.api.remoteExecCommand('df -h /')
                const lines = dfRaw.trim().split('\n')
                if (lines.length > 1) {
                    // /dev/sda1 50G 10G 40G 20% /
                    const parts = lines[1].trim().split(/\s+/)
                    if (parts.length >= 5) {
                        diskTotal = parts[1]
                        diskUsedRatio = parseFloat(parts[4].replace('%', ''))
                    }
                }
            } catch (e) {
                console.warn('Could not parse df command', e)
            }

            setMetrics({
                uptime,
                cpuLoad: Math.min(cpuLoad, 100), // Cap at 100 for visual
                memTotal,
                memUsedRatio,
                diskTotal,
                diskUsedRatio
            })

            // 4. Top Processes
            try {
                const psRaw = await window.api.remoteExecCommand('ps -eo pid,%mem,%cpu,comm --sort=-%cpu | head -6')
                const lines = psRaw.trim().split('\n').slice(1) // skip header
                const procs = lines.map(line => {
                    const parts = line.trim().split(/\s+/)
                    return {
                        pid: parts[0],
                        mem: parts[1],
                        cpu: parts[2],
                        cmd: parts.slice(3).join(' ')
                    }
                })
                setProcesses(procs)
            } catch (e) {
                console.warn('Could not fetch processes', e)
            }

            // 5. Network Interfaces (only fetch once or periodically)
            try {
                const ipRaw = await window.api.remoteExecCommand('ip -4 addr show || ifconfig')
                setNetworkInfo(ipRaw.trim())
            } catch (e) {
                setNetworkInfo('Network info unavailable')
            }

            // 6. System Logs (Tail)
            try {
                // Try syslog first, fallback to dmesg if permission denied
                const logRaw = await window.api.remoteExecCommand('tail -n 10 /var/log/syslog 2>/dev/null || tail -n 10 /var/log/messages 2>/dev/null || dmesg | tail -n 10')
                setSysLogs(logRaw.trim() || 'No logs available or permission denied.')
            } catch (e) {
                setSysLogs('Logs unavailable. Requires root privileges.')
            }

            setError(null)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchMetrics()
        const interval = setInterval(fetchMetrics, 5000)
        return () => clearInterval(interval)
    }, [fetchMetrics])

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 text-zinc-400">
                <div className="text-center max-w-md">
                    <Activity className="h-12 w-12 text-red-500 mx-auto mb-4 opacity-50" />
                    <h2 className="text-lg font-medium text-zinc-200 mb-2">Metrics Unavailable</h2>
                    <p className="text-sm">{error}</p>
                    <p className="text-xs mt-4 text-zinc-500">Note: This dashboard requires standard Linux utilities (uptime, free, df) on the remote server.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-auto p-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
                            <Activity className="h-6 w-6 text-blue-500" />
                            Server Health
                        </h1>
                        <p className="text-sm text-zinc-400 mt-1">Real-time telemetry and resource utilization</p>
                    </div>
                    {loading && !metrics && (
                        <div className="flex items-center gap-2 text-zinc-500 text-sm">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Polling metrics...
                        </div>
                    )}
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* CPU Card */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                            <Cpu className="h-24 w-24" />
                        </div>
                        <h3 className="text-zinc-400 font-medium text-sm flex items-center gap-2 mb-6">
                            <Cpu className="h-4 w-4" />
                            CPU Load
                        </h3>
                        <div className="flex justify-center">
                            <CircularProgress
                                value={metrics?.cpuLoad || 0}
                                label="Avg Load"
                                colorClass="stroke-blue-500"
                            />
                        </div>
                    </div>

                    {/* Ram Card */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                            <Server className="h-24 w-24" />
                        </div>
                        <h3 className="text-zinc-400 font-medium text-sm flex items-center gap-2 mb-6">
                            <Server className="h-4 w-4" />
                            Memory Usage
                        </h3>
                        <div className="flex justify-center">
                            <CircularProgress
                                value={metrics?.memUsedRatio || 0}
                                label={metrics?.memTotal ? `${metrics.memTotal} Total` : 'RAM'}
                                colorClass="stroke-violet-500"
                            />
                        </div>
                    </div>

                    {/* Disk Card */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                            <HardDrive className="h-24 w-24" />
                        </div>
                        <h3 className="text-zinc-400 font-medium text-sm flex items-center gap-2 mb-6">
                            <HardDrive className="h-4 w-4" />
                            Root Disk (/)
                        </h3>
                        <div className="flex justify-center">
                            <CircularProgress
                                value={metrics?.diskUsedRatio || 0}
                                label={metrics?.diskTotal ? `${metrics.diskTotal} Total` : 'Disk'}
                                colorClass="stroke-emerald-500"
                            />
                        </div>
                    </div>

                </div>

                {/* Advanced Utilities Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Top Processes */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-zinc-800 flex items-center gap-2 text-zinc-300 font-medium">
                            <List className="h-4 w-4 text-blue-400" />
                            Active Processes
                        </div>
                        <div className="p-4 flex-1 overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-zinc-500 text-xs uppercase">
                                    <tr>
                                        <th className="pb-2 font-medium">PID</th>
                                        <th className="pb-2 font-medium">Command</th>
                                        <th className="pb-2 font-medium text-right">CPU%</th>
                                        <th className="pb-2 font-medium text-right">MEM%</th>
                                    </tr>
                                </thead>
                                <tbody className="text-zinc-300">
                                    {processes.map(proc => (
                                        <tr key={proc.pid} className="border-t border-zinc-800/50">
                                            <td className="py-2 text-zinc-500">{proc.pid}</td>
                                            <td className="py-2 truncate max-w-[120px]" title={proc.cmd}>{proc.cmd}</td>
                                            <td className="py-2 text-right font-mono">{proc.cpu}</td>
                                            <td className="py-2 text-right font-mono">{proc.mem}</td>
                                        </tr>
                                    ))}
                                    {processes.length === 0 && (
                                        <tr><td colSpan={4} className="py-4 text-center text-zinc-600">No process data</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Network Interfaces */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-zinc-800 flex items-center gap-2 text-zinc-300 font-medium">
                            <Network className="h-4 w-4 text-emerald-400" />
                            Network Interfaces
                        </div>
                        <div className="p-4 flex-1 overflow-auto bg-black/20">
                            <pre className="text-xs text-emerald-500/80 font-mono whitespace-pre-wrap break-words">
                                {networkInfo}
                            </pre>
                        </div>
                    </div>

                </div>

                {/* System Logs */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-zinc-300 font-medium">
                            <Terminal className="h-4 w-4 text-orange-400" />
                            System Activity Log
                        </div>
                        <span className="text-[10px] uppercase text-zinc-600 border border-zinc-700 px-2 py-0.5 rounded">Tail -n 10</span>
                    </div>
                    <div className="p-4 overflow-auto bg-[#0a0a0a] min-h-[160px]">
                        <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">
                            {sysLogs}
                        </pre>
                    </div>
                </div>

                {/* Server Info Footer */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 text-sm text-zinc-400">
                    <Clock className="h-4 w-4 text-zinc-500" />
                    <span><strong className="text-zinc-300">Uptime:</strong> {metrics?.uptime || 'Calculating...'}</span>
                    <span className="flex-1"></span>
                    <span className="text-xs text-zinc-600">Updated every 5s</span>
                </div>

            </div>
        </div>
    )
}
