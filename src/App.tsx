import { useState, useEffect } from 'react'
import { Shell } from './components/Shell'
import { Toaster, toast } from 'sonner'
import { ConnectionManager } from './components/ConnectionManager'
import { FileExplorer } from './components/FileExplorer'
import { SessionsView } from './components/SessionsView'
import { TransferManager } from './components/TransferManager'

import { TerminalView } from './components/TerminalView'
import { SettingsView } from './components/SettingsView'
import { AppSettings, defaultSettings } from './types'
import { MasterPasswordModal } from './components/MasterPasswordModal'

function App() {
  const [activeTab, setActiveTab] = useState<'manager' | 'sessions' | 'terminal' | 'settings'>('manager')
  const [isConnected, setIsConnected] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [isUnlocked, setIsUnlocked] = useState(false)

  useEffect(() => {
    window.api.encryptionUnlocked().then(setIsUnlocked)
    window.api.settingsGetAppSettings().then(setSettings)
  }, [])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    if (settings.theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(settings.theme)
    }
  }, [settings.theme])

  return (
    <div className="h-screen w-screen overflow-hidden text-zinc-100 antialiased selection:bg-blue-500/30">
      {!isUnlocked && (
        <MasterPasswordModal onUnlock={() => setIsUnlocked(true)} />
      )}
      <Shell activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'manager' && !isConnected && (
          <ConnectionManager onConnect={() => setIsConnected(true)} />
        )}
        {activeTab === 'manager' && isConnected && (
          <div className="h-full flex flex-col">
            {/* Toolbar could go here */}
            <div className="flex-1 min-h-0">
              <FileExplorer settings={settings} />
            </div>

            {/* Status Bar */}
            <div className="h-8 border-t border-zinc-800 bg-zinc-900/50 flex items-center px-4 gap-4 text-xs font-mono text-zinc-500">
              <span className="text-green-500">Connected</span>
              <div className="flex-1" />
              <button
                onClick={async () => {
                  await window.api.remoteDisconnect()
                  setIsConnected(false)
                }}
                className="hover:text-red-400 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
        {activeTab === 'sessions' && (
          <SessionsView
            onConnect={async (profile) => {
              try {
                await window.api.remoteConnect({
                  host: profile.host,
                  port: profile.port,
                  username: profile.username,
                  password: profile.password,
                  privateKeyPath: profile.privateKeyPath,
                  protocol: profile.protocol || 'sftp'
                })
                setIsConnected(true)
                setActiveTab('manager') // Switch to manager view to see files
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Connection failed'
                toast.error(message)
              }
            }}
          />
        )}
        {activeTab === 'terminal' && (
          <TerminalView />
        )}
        {activeTab === 'settings' && (
          <SettingsView onSave={setSettings} />
        )}
      </Shell>
      <Toaster position="bottom-right" theme="dark" />
      <TransferManager />
    </div>
  )
}

export default App
