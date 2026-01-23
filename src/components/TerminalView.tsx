import { useEffect, useRef } from 'react'
import { Terminal as TerminalIcon } from 'lucide-react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

export function TerminalView() {
    const containerRef = useRef<HTMLDivElement>(null)
    const termRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)

    useEffect(() => {
        if (!containerRef.current) return

        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0c0c0c',
                foreground: '#d4d4d8',
                cursor: '#52525b',
                selectionBackground: '#3f3f46',
                black: '#0c0c0c'
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 13,
            allowProposedApi: true
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        term.open(containerRef.current)
        fitAddon.fit()

        termRef.current = term
        fitAddonRef.current = fitAddon

        // Start shell
        window.api.sshShellStart(term.rows, term.cols).catch(err => {
            term.write('\r\n\x1b[31mFailed to start shell or not connected.\x1b[0m\r\n')
            console.error(err)
        })

        // Output to backend
        term.onData(data => {
            window.api.sshShellWrite(data)
        })

        // Input from backend
        const cleanupListener = window.api.onShellData(data => {
            term.write(data)
        })

        // Handle resize
        const handleResize = () => {
            fitAddon.fit()
            window.api.sshShellResize(term.rows, term.cols)
        }

        // Resize observer for container
        const resizeObserver = new ResizeObserver(() => {
            // specific logic to debounce or wait for layout might be needed
            // but calling fit() directly usually works
            handleResize()
        })
        resizeObserver.observe(containerRef.current)

        window.addEventListener('resize', handleResize)

        term.focus()

        return () => {
            cleanupListener()
            window.removeEventListener('resize', handleResize)
            resizeObserver.disconnect()
            term.dispose()
        }
    }, [])

    return (
        <div className="h-full flex flex-col bg-[#0c0c0c] rounded-xl overflow-hidden border border-zinc-800 font-mono text-sm shadow-inner">
            {/* Terminal Header */}
            <div className="bg-[#1c1c1c] px-4 py-2 flex items-center gap-2 border-b border-zinc-800 select-none">
                <TerminalIcon className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-zinc-400 text-xs font-medium">Remote Terminal</span>
                <div className="flex-1" />
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-600/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-600/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-600/50" />
                </div>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 p-1 bg-[#0c0c0c] overflow-hidden">
                <div ref={containerRef} className="h-full w-full" />
            </div>
        </div>
    )
}
