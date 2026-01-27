import { useState } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'
import { useAppStore } from '../stores/appStore'
import { useJobProgress } from '../hooks/useJobProgress'
import MediaGrid from './MediaGrid'
import ProgressBar from './ProgressBar'

export default function ReviewTab() {
  const api = useElectronAPI()
  const activeSiteId = useAppStore((state) => state.activeSiteId)
  const mediaItems = useAppStore((state) => state.mediaItems)
  const selectedItems = useAppStore((state) => state.selectedItems)
  const selectAllItems = useAppStore((state) => state.selectAllItems)
  const clearSelection = useAppStore((state) => state.clearSelection)
  const setCurrentJob = useAppStore((state) => state.setCurrentJob)
  const settings = useAppStore((state) => state.settings)

  const [error, setError] = useState('')
  const [exportData, setExportData] = useState('')

  const currentJob = useJobProgress()
  const isRunning = currentJob?.status === 'running'

  const itemsToProcess = mediaItems.filter((item) =>
    selectedItems.includes(item.id)
  )

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

  const handleCancel = () => {
    if (currentJob?.jobId) api.job.cancel(currentJob.jobId)
  }

  const handleExport = async (format) => {
    if (!currentJob?.jobId) return
    const data = await api.job.export({ jobId: currentJob.jobId, format })
    setExportData(data)

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

  if (mediaItems.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <p>No media scanned. Go to Scan tab first.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Review & Apply Alt Text</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div>
            <strong>{selectedItems.length}</strong> of {mediaItems.length}{' '}
            selected
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={selectAllItems}>
              Select All
            </button>
            <button className="btn btn-secondary" onClick={clearSelection}>
              Clear Selection
            </button>
          </div>
        </div>

        {currentJob && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span>
                {currentJob.status === 'running' ? 'Processing...' : currentJob.status}
              </span>
              <span>
                {currentJob.completed || 0} / {currentJob.total} completed
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
                  <button className="btn btn-secondary" onClick={handleCancel}>
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
                    Export CSV
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleExport('json')}
                  >
                    Export JSON
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
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
      </div>

      <MediaGrid items={mediaItems} selectable showProposed />
    </div>
  )
}
