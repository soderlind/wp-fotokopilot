import { useState, useEffect } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'
import { useAppStore } from '../stores/appStore'

export default function ConnectTab() {
  const api = useElectronAPI()
  const { sites, setSites, addSite, removeSite, activeSiteId, setActiveSite } =
    useAppStore()

  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState(undefined)

  useEffect(() => {
    api.site.list().then(setSites).catch(console.error)
  }, [api, setSites])

  const handleTest = async () => {
    setTesting(true)
    setError('')
    setTestResult(undefined)
    try {
      const result = await api.site.test({ url, username, password })
      setTestResult(result)
    } catch (err) {
      setError(err.message || 'Connection failed')
    } finally {
      setTesting(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    setError('')
    try {
      const id = crypto.randomUUID()
      const site = await api.site.add({ id, url, username, password })
      addSite(site)
      setActiveSite(id)
      setUrl('')
      setUsername('')
      setPassword('')
      setTestResult(undefined)
    } catch (err) {
      setError(err.message || 'Failed to save site')
    } finally {
      setConnecting(false)
    }
  }

  const handleSelectSite = (siteId) => {
    setActiveSite(siteId)
  }

  const handleRemoveSite = async (siteId) => {
    await api.site.remove(siteId)
    removeSite(siteId)
  }

  return (
    <div>
      <h1 className="page-title">Connect to WordPress</h1>

      {sites.length > 0 && (
        <div className="card">
          <h2 className="card-title">Saved Sites</h2>
          <ul style={{ listStyle: 'none' }}>
            {sites.map((site) => (
              <li
                key={site.id}
                className="flex items-center justify-between"
                style={{
                  padding: '12px',
                  background:
                    activeSiteId === site.id
                      ? 'var(--accent)'
                      : 'var(--bg-card)',
                  borderRadius: 'var(--radius)',
                  marginBottom: '8px',
                }}
              >
                <div>
                  <strong>{site.name || site.url}</strong>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>
                    {site.url}
                    {site.capabilities?.vmf && ' • VMF ✓'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleSelectSite(site.id)}
                    disabled={activeSiteId === site.id}
                  >
                    {activeSiteId === site.id ? 'Active' : 'Select'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleRemoveSite(site.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">Add New Site</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Site URL</label>
          <input
            type="url"
            className="form-input"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            className="form-input"
            placeholder="admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Application Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            Generate in wp-admin → Users → Your Profile → Application Passwords
          </small>
        </div>

        {testResult && (
          <div className="alert alert-success">
            <strong>Connection successful!</strong>
            <div>Site: {testResult.name}</div>
            <div>REST API: ✓</div>
            <div>VMF: {testResult.capabilities?.vmf ? '✓' : '✗ (not installed)'}</div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            className="btn btn-secondary"
            onClick={handleTest}
            disabled={!url || !username || !password || testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={!testResult || connecting}
          >
            {connecting ? 'Saving...' : 'Save & Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}
