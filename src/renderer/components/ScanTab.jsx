import { useState } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'
import { useAppStore } from '../stores/appStore'
import { useScanProgress } from '../hooks/useScanProgress'
import MediaGrid from './MediaGrid'

export default function ScanTab() {
  const api = useElectronAPI()
  const activeSiteId = useAppStore((state) => state.activeSiteId)
  const mediaItems = useAppStore((state) => state.mediaItems)
  const clearMediaItems = useAppStore((state) => state.clearMediaItems)

  const [scanning, setScanning] = useState(false)
  const [missingAltOnly, setMissingAltOnly] = useState(true)
  const [limit, setLimit] = useState('')
  const [error, setError] = useState('')

  useScanProgress()

  const handleScan = async () => {
    setScanning(true)
    setError('')
    clearMediaItems()
    try {
      await api.scan.start({
        siteId: activeSiteId,
        missingAltOnly,
        limit: limit ? parseInt(limit) : undefined,
      })
    } catch (err) {
      setError(err.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const handleCancel = async () => {
    await api.scan.cancel()
    setScanning(false)
  }

  if (!activeSiteId) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔗</div>
        <p>Please connect to a WordPress site first</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Scan Media Library</h1>

      <div className="card">
        <h2 className="card-title">Scan Options</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="flex gap-4 items-center mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="checkbox"
              checked={missingAltOnly}
              onChange={(e) => setMissingAltOnly(e.target.checked)}
            />
            Missing alt text only
          </label>

          <div className="flex items-center gap-2">
            <label className="form-label" style={{ marginBottom: 0 }}>
              Limit:
            </label>
            <input
              type="number"
              className="form-input"
              style={{ width: '100px' }}
              placeholder="No limit"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              min="1"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="btn btn-primary"
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? 'Scanning...' : 'Start Scan'}
          </button>
          {scanning && (
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {mediaItems.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title" style={{ marginBottom: 0 }}>
              Found {mediaItems.length} images
            </h2>
            <button className="btn btn-secondary" onClick={clearMediaItems}>
              Clear
            </button>
          </div>
          <MediaGrid items={mediaItems} selectable />
        </div>
      )}

      {!scanning && mediaItems.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p>No media scanned yet. Click "Start Scan" to begin.</p>
        </div>
      )}
    </div>
  )
}
