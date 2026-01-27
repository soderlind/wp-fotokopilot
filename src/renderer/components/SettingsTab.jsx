import { useState, useEffect } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'
import { useAppStore } from '../stores/appStore'

export default function SettingsTab() {
  const api = useElectronAPI()
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)

  const [localSettings, setLocalSettings] = useState(settings)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.settings.get().then((s) => {
      if (s) {
        setSettings(s)
        setLocalSettings(s)
      }
    })
  }, [api])

  const handleSave = async () => {
    await api.settings.set(localSettings)
    setSettings(localSettings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateSetting = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>

      {saved && (
        <div className="alert alert-success">Settings saved successfully!</div>
      )}

      <div className="card">
        <h2 className="card-title">Alt Text Generation</h2>

        <div className="form-group">
          <label className="form-label">Maximum alt text length</label>
          <input
            type="number"
            className="form-input"
            style={{ width: '150px' }}
            value={localSettings.maxAltLength || 125}
            onChange={(e) =>
              updateSetting('maxAltLength', parseInt(e.target.value))
            }
            min="50"
            max="300"
          />
          <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
            Recommended: 125-150 characters
          </small>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Processing</h2>

        <div className="form-group">
          <label className="form-label">Concurrent jobs</label>
          <input
            type="number"
            className="form-input"
            style={{ width: '150px' }}
            value={localSettings.concurrency || 3}
            onChange={(e) =>
              updateSetting('concurrency', parseInt(e.target.value))
            }
            min="1"
            max="10"
          />
          <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
            Higher values are faster but may hit rate limits
          </small>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Export</h2>

        <div className="form-group">
          <label className="form-label">Default export format</label>
          <select
            className="form-input"
            style={{ width: '150px' }}
            value={localSettings.exportFormat || 'csv'}
            onChange={(e) => updateSetting('exportFormat', e.target.value)}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">GitHub Copilot</h2>

        <div className="form-group">
          <label className="form-label">CLI Server URL</label>
          <input
            type="text"
            className="form-input"
            style={{ width: '250px' }}
            value={localSettings.copilotServerUrl || ''}
            onChange={(e) => updateSetting('copilotServerUrl', e.target.value.trim())}
            placeholder="localhost:4321"
          />
          <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
            Leave empty to auto-manage CLI. To use server mode, run:{' '}
            <code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>
              copilot --server --port 4321
            </code>
          </small>
        </div>
      </div>

      <button className="btn btn-primary mt-4" onClick={handleSave}>
        Save Settings
      </button>
    </div>
  )
}
