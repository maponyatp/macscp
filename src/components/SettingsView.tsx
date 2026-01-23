import { Monitor, Moon, Save, Folder, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { AppSettings, defaultSettings } from '../types'

export function SettingsView({ onSave }: { onSave?: (settings: AppSettings) => void }) {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadSettings()
    }, [])

    async function loadSettings() {
        const loaded = await window.api.settingsGetAppSettings()
        setSettings(loaded)
    }

    async function handleSave() {
        setSaving(true)
        try {
            await window.api.settingsSaveAppSettings(settings)
            if (onSave) onSave(settings)
            // Toast should be handled by toaster if we had it here, or just rely on saving state
            // For now, let's assume success
            alert('Settings saved') // Replace with toast if possible, or leave for later cleanup
        } catch (error) {
            console.error(error)
            alert('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto mt-10 pb-10">
            <h2 className="text-2xl font-bold mb-6 text-zinc-100">Settings</h2>

            <div className="space-y-6">
                {/* Appearance Section */}
                <div className="bg-zinc-800/30 border border-zinc-700 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-700 font-medium text-sm text-zinc-300 flex items-center gap-2">
                        <Monitor className="h-4 w-4" /> Appearance
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Moon className="h-4 w-4 text-zinc-400" />
                                <span className="text-sm text-zinc-300">Theme</span>
                            </div>
                            <select
                                value={settings.theme}
                                onChange={(e) => setSettings({ ...settings, theme: e.target.value as AppSettings['theme'] })}
                                className="bg-zinc-900 border border-zinc-700 text-sm rounded px-2 py-1 text-zinc-300 focus:outline-none"
                            >
                                <option value="system">System Default</option>
                                <option value="dark">Dark</option>
                                <option value="light">Light</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* File Explorer Section */}
                <div className="bg-zinc-800/30 border border-zinc-700 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-700 font-medium text-sm text-zinc-300 flex items-center gap-2">
                        <Folder className="h-4 w-4" /> File Explorer
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Default Local Path</label>
                            <input
                                type="text"
                                value={settings.defaultLocalPath}
                                onChange={(e) => setSettings({ ...settings, defaultLocalPath: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-blue-500 font-mono"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-300">Show Hidden Files (dotfiles)</span>
                            <button
                                onClick={() => setSettings({ ...settings, showHiddenFiles: !settings.showHiddenFiles })}
                                className={`w-10 h-5 rounded-full relative transition-colors ${settings.showHiddenFiles ? 'bg-blue-600' : 'bg-zinc-600'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.showHiddenFiles ? 'left-6' : 'left-1'}`}></div>
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Trash2 className="h-4 w-4 text-zinc-400" />
                                <span className="text-sm text-zinc-300">Confirm on Delete</span>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, confirmOnDelete: !settings.confirmOnDelete })}
                                className={`w-10 h-5 rounded-full relative transition-colors ${settings.confirmOnDelete ? 'bg-blue-600' : 'bg-zinc-600'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.confirmOnDelete ? 'left-6' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}
