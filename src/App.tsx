import { useState, useEffect, useCallback } from 'react'
import { Shell } from './components/Shell'
import { Toaster, toast } from 'sonner'
import { ConnectionManager } from './components/ConnectionManager'
import { FileExplorer } from './components/FileExplorer'
import { SessionsView } from './components/SessionsView'
import { TransferManager } from './components/TransferManager'

import { TerminalView } from './components/TerminalView'
import { SettingsView } from './components/SettingsView'
import { AppSettings, defaultSettings, SSHProfile } from './types'
import { MasterPasswordModal } from './components/MasterPasswordModal'
import { CommandPalette } from './components/CommandPalette'
import { ServerDashboard } from './components/ServerDashboard'

function App() {
  const [activeTab, setActiveTab] = useState<'manager' | 'sessions' | 'terminal' | 'dashboard' | 'settings'>('manager')
  const [isConnected, setIsConnected] = useState(false)
  const [activeConfig, setActiveConfig] = useState<Partial<SSHProfile> | null>(null)
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [profiles, setProfiles] = useState<SSHProfile[]>([])

  const loadProfiles = useCallback(async () => {
    const saved = await window.api.settingsListProfiles()
    setProfiles(saved || [])
  }, [])

  const saveCurrentSession = useCallback(async () => {
    if (!activeConfig) return

    const isAlreadySaved = profiles.find(p =>
      p.host === activeConfig.host &&
      p.username === activeConfig.username &&
      p.protocol === (activeConfig.protocol || 'sftp')
    )

    if (!isAlreadySaved) {
      const profile: SSHProfile = {
        ...activeConfig as SSHProfile,
        id: crypto.randomUUID(),
        name: `${activeConfig.username}@${activeConfig.host}`,
        port: activeConfig.port || 22,
        protocol: activeConfig.protocol || 'sftp'
      }

      await window.api.settingsSaveProfile(profile)
      await loadProfiles()
      return true
    }
    return false
  }, [activeConfig, profiles, loadProfiles])

  useEffect(() => {
    window.api.encryptionUnlocked().then(setIsUnlocked)
    window.api.settingsGetAppSettings().then(setSettings)
    loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    const root = window.document.documentElement
    if (settings.theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', systemDark)
    } else {
      root.classList.toggle('dark', settings.theme === 'dark')
    }
  }, [settings.theme])

  // Auto-save session when entering terminal
  useEffect(() => {
    if (activeTab === 'terminal' && isConnected && activeConfig) {
      saveCurrentSession().then((saved) => {
        if (saved) {
          toast.success('Session auto-saved for terminal access', {
            description: 'Connection details preserved in profiles'
          })
        }
      })
    }
  }, [activeTab, isConnected, activeConfig, saveCurrentSession])

  return (
    <div className="h-screen w-screen overflow-hidden text-zinc-100 antialiased selection:bg-blue-500/30">
      <CommandPalette
        profiles={profiles}
        onNavigate={setActiveTab}
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
            setActiveConfig(profile)
            setActiveTab('manager')
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Connection failed'
            toast.error(message)
          }
        }}
      />
      {!isUnlocked && (
        <MasterPasswordModal onUnlock={() => setIsUnlocked(true)} />
      )}
      <Shell activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'manager' && !isConnected && (
          <ConnectionManager onConnect={(config) => {
            setIsConnected(true)
            setActiveConfig(config)
            loadProfiles()
          }} />
        )}
        {activeTab === 'manager' && isConnected && (
          <div className="h-full flex flex-col">
            {/* Toolbar could go here */}
            <div className="flex-1 min-h-0">
              <FileExplorer settings={settings} initialRemotePath={activeConfig?.folder} />
            </div>

            {/* Status Bar */}
            <div className="h-8 border-t border-zinc-800 bg-zinc-900/50 flex items-center px-4 gap-4 text-xs font-mono text-zinc-500">
              <span className="text-green-500">Connected</span>
              <div className="flex-1" />
              {activeConfig && !profiles.find(p =>
                p.host === activeConfig.host &&
                p.username === activeConfig.username &&
                p.protocol === activeConfig.protocol
              ) && (
                  <button
                    onClick={async () => {
                      const saved = await saveCurrentSession()
                      if (saved) toast.success('Session saved to profiles')
                    }}
                    className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/40 transition-colors flex items-center gap-1 border border-blue-500/30"
                  >
                    Save Session
                  </button>
                )}
              <button
                onClick={async () => {
                  await window.api.remoteDisconnect()
                  setIsConnected(false)
                  setActiveConfig(null)
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
                setActiveConfig(profile) // Track the active config
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
        {activeTab === 'dashboard' && (
          <ServerDashboard />
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
