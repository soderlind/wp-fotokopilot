import { useState, useEffect } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'
import { useAppStore } from '../stores/appStore'
import { useScanProgress } from '../hooks/useScanProgress'
import { useJobProgress } from '../hooks/useJobProgress'
import MediaGrid from './MediaGrid'
import ProgressBar from './ProgressBar'

export default function MediaTab() {
  const api = useElectronAPI()
  const activeSiteId = useAppStore((state) => state.activeSiteId)
  const sites = useAppStore((state) => state.sites)
  const setSites = useAppStore((state) => state.setSites)
  const mediaItems = useAppStore((state) => state.mediaItems)
  const selectedItems = useAppStore((state) => state.selectedItems)
  const selectAllItems = useAppStore((state) => state.selectAllItems)
  const clearSelection = useAppStore((state) => state.clearSelection)
  const clearMediaItems = useAppStore((state) => state.clearMediaItems)
  const setCurrentJob = useAppStore((state) => state.setCurrentJob)

  const [scanning, setScanning] = useState(false)
  const [missingAltOnly, setMissingAltOnly] = useState(true)
  const [limit, setLimit] = useState('')
  const [error, setError] = useState('')
  const [verifyingSite, setVerifyingSite] = useState(false)
  const [siteUnreachable, setSiteUnreachable] = useState(false)

  useScanProgress()
  const currentJob = useJobProgress()
  const isRunning = currentJob?.status === 'running'

  // Verify site is reachable when tab loads
  useEffect(() => {
    if (activeSiteId) {
      verifySite()
    }
  }, [activeSiteId])

  const verifySite = async () => {
    setVerifyingSite(true)
    setSiteUnreachable(false)
    setError('')
    try {
      const refreshedSite = await api.site.refresh(activeSiteId)
      // Update sites list with refreshed info
      setSites(sites.map(s => 
        s.id === activeSiteId ? { ...s, ...refreshedSite } : s
      ))
    } catch (err) {
      setSiteUnreachable(true)
      setError(`Site unreachable: ${err.message}`)
    } finally {
      setVerifyingSite(false)
    }
  }

  const itemsToProcess = mediaItems.filter((item) =>
    selectedItems.includes(item.id)
  )

  // Scan handlers
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

  const handleCancelScan = async () => {
    await api.scan.cancel()
    setScanning(false)
  }

  // Job handlers
  const handleGenerateAlt = async () => {
    if (itemsToProcess.length === 0) return
    setError('')
    try {
      const { jobId } = await api.job.start({
        type: 'generate',
        siteId: activeSiteId,
        items: itemsToProcess,
      })
      setCurrentJob({ jobId, status: 'running', total: itemsToProcess.length })
    } catch (err) {
      setError(err.message || 'Failed to start job')
    }
  }

  const handleApply = async () => {
    const itemsWithAlt = itemsToProcess.filter((item) => item.proposedAlt)
    if (itemsWithAlt.length === 0) return
    setError('')
    try {
      const { jobId } = await api.job.start({
        type: 'apply',
        siteId: activeSiteId,
        items: itemsWithAlt,
      })
      setCurrentJob({ jobId, status: 'running', total: itemsWithAlt.length })
    } catch (err) {
      setError(err.message || 'Failed to start job')
    }
  }

  const handlePause = () => {
    if (currentJob?.jobId) api.job.pause(currentJob.jobId)
  }

  const handleResume = () => {
    if (currentJob?.jobId) api.job.resume(currentJob.jobId)
  }

  const handleCancelJob = () => {
    if (currentJob?.jobId) api.job.cancel(currentJob.jobId)
  }

  const handleExport = async (format) => {
    if (!currentJob?.jobId) return
    const data = await api.job.export({ jobId: currentJob.jobId, format })

    const blob = new Blob([data], {
      type: format === 'json' ? 'application/json' : 'text/csv',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fotokopilot-export-${Date.now()}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!activeSiteId) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔗</div>
        <p>Please connect to a WordPress site first</p>
      </div>
    )
  }

  if (verifyingSite) {
    return (
      <div>
        <h1 className="page-title">Media Library</h1>
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>
            Verifying site connection...
          </p>
        </div>
      </div>
    )
  }

  if (siteUnreachable) {
    return (
      <div>
        <h1 className="page-title">Media Library</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="empty-state-icon">⚠️</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Cannot connect to the WordPress site. Please check that the site is online and your credentials are valid.
          </p>
          <button className="btn btn-primary" onClick={verifySite}>
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Media Library</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Scan Controls */}
      <div className="card">
        <div className="flex justify-between items-center">
          <div className="flex gap-4 items-center">
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
                style={{ width: '80px' }}
                placeholder="All"
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
              disabled={scanning || isRunning}
            >
              {scanning ? '🔍 Scanning...' : '🔍 Scan'}
            </button>
            {scanning && (
              <button className="btn btn-secondary" onClick={handleCancelScan}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results & Actions */}
      {mediaItems.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-4 items-center">
              <span>
                <strong>{mediaItems.length}</strong> images found
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                <strong>{selectedItems.length}</strong> selected
              </span>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={selectAllItems}>
                Select All
              </button>
              <button className="btn btn-secondary" onClick={clearSelection}>
                Clear
              </button>
              <button className="btn btn-secondary" onClick={clearMediaItems}>
                Reset
              </button>
            </div>
          </div>

          {/* Job Progress */}
          {currentJob && (
            <div className="mb-4" style={{ 
              padding: '12px', 
              background: 'var(--bg-tertiary)', 
              borderRadius: 'var(--radius)' 
            }}>
              <div className="flex justify-between items-center mb-2">
                <span>
                  {currentJob.status === 'running' ? '⏳ Processing...' : 
                   currentJob.status === 'paused' ? '⏸️ Paused' :
                   currentJob.status === 'completed' ? '✅ Completed' :
                   currentJob.status === 'completed_with_errors' ? '⚠️ Completed with errors' :
                   currentJob.status}
                </span>
                <span>
                  {currentJob.completed || 0} / {currentJob.total}
                  {currentJob.failed > 0 && ` (${currentJob.failed} failed)`}
                </span>
              </div>
              <ProgressBar
                value={currentJob.completed || 0}
                max={currentJob.total}
              />
              <div className="flex gap-2 mt-2">
                {isRunning && (
                  <>
                    <button className="btn btn-secondary" onClick={handlePause}>
                      Pause
                    </button>
                    <button className="btn btn-secondary" onClick={handleCancelJob}>
                      Cancel
                    </button>
                  </>
                )}
                {currentJob.status === 'paused' && (
                  <button className="btn btn-primary" onClick={handleResume}>
                    Resume
                  </button>
                )}
                {(currentJob.status === 'completed' ||
                  currentJob.status === 'completed_with_errors') && (
                  <>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleExport('csv')}
                    >
                      📥 Export CSV
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleExport('json')}
                    >
                      📥 Export JSON
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              className="btn btn-primary"
              onClick={handleGenerateAlt}
              disabled={selectedItems.length === 0 || isRunning}
            >
              🤖 Generate Alt Text ({selectedItems.length})
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleApply}
              disabled={
                itemsToProcess.filter((i) => i.proposedAlt).length === 0 ||
                isRunning
              }
            >
              ✅ Apply to WordPress
            </button>
          </div>

          <MediaGrid items={mediaItems} selectable showProposed />
        </div>
      )}

      {!scanning && mediaItems.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p>Click "Scan" to find images in your media library</p>
        </div>
      )}
    </div>
  )
}
