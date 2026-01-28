import { useState, useEffect, useMemo } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'
import { useAppStore } from '../stores/appStore'
import { useJobProgress } from '../hooks/useJobProgress'
import ProgressBar from './ProgressBar'
import vmfIcon from '../assets/vmf-icon.svg'

export default function FoldersTab() {
  const api = useElectronAPI()
  const activeSiteId = useAppStore((state) => state.activeSiteId)
  const sites = useAppStore((state) => state.sites)
  const setSites = useAppStore((state) => state.setSites)
  const folders = useAppStore((state) => state.folders)
  const setFolders = useAppStore((state) => state.setFolders)
  const setCurrentJob = useAppStore((state) => state.setCurrentJob)
  
  // Get the active site to check capabilities
  const activeSite = useMemo(() => 
    sites.find(s => s.id === activeSiteId), 
    [sites, activeSiteId]
  )
  const hasVmf = activeSite?.capabilities?.vmf === true

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [installingVmf, setInstallingVmf] = useState(false)
  const [vmfInstallError, setVmfInstallError] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedParent, setSelectedParent] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  const [showHierarchy, setShowHierarchy] = useState(false)
  const [checkingVmf, setCheckingVmf] = useState(false)
  
  // Media state
  const [mediaItems, setMediaItems] = useState([])
  const [scanning, setScanning] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState([])
  const [dismissedSuggestions, setDismissedSuggestions] = useState(new Set())
  const [scanMode, setScanMode] = useState('uncategorized') // 'uncategorized' | 'all'
  const [previewImage, setPreviewImage] = useState(null) // For image modal
  
  const currentJob = useJobProgress()
  const isRunning = currentJob?.status === 'running'

  // Check VMF availability each time the tab is opened
  useEffect(() => {
    if (activeSiteId) {
      checkVmfAvailability()
    }
  }, [activeSiteId])

  const checkVmfAvailability = async () => {
    setCheckingVmf(true)
    try {
      const refreshedSite = await api.site.refresh(activeSiteId)
      // Update sites list with refreshed capabilities
      const updatedSites = sites.map(s => 
        s.id === activeSiteId ? { ...s, ...refreshedSite } : s
      )
      setSites(updatedSites)
      
      // If VMF is available, load folders
      if (refreshedSite.capabilities?.vmf) {
        await loadFolders()
      }
    } catch (err) {
      console.error('Failed to check VMF availability:', err)
      setError(err.message || 'Failed to check VMF availability')
    } finally {
      setCheckingVmf(false)
    }
  }

  const loadFolders = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.vmf.list(activeSiteId)
      setFolders(result || [])
    } catch (err) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        setError('VMF plugin not installed on this site')
      } else {
        setError(err.message || 'Failed to load folders')
      }
      setFolders([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setCreating(true)
    setError('')
    try {
      await api.vmf.create(
        activeSiteId,
        newFolderName.trim(),
        selectedParent ? parseInt(selectedParent) : null
      )
      setNewFolderName('')
      setSelectedParent('')
      await loadFolders()
    } catch (err) {
      setError(err.message || 'Failed to create folder')
    } finally {
      setCreating(false)
    }
  }

  const handleScanUncategorized = async () => {
    setScanning(true)
    setError('')
    setDismissedSuggestions(new Set())
    try {
      const result = await api.vmf.uncategorized(activeSiteId, 100)
      setMediaItems(result || [])
      setSelectedMedia([])
      setScanMode('uncategorized')
    } catch (err) {
      setError(err.message || 'Failed to scan uncategorized media')
    } finally {
      setScanning(false)
    }
  }

  const handleScanAll = async () => {
    setScanning(true)
    setError('')
    setDismissedSuggestions(new Set())
    try {
      const result = await api.media.scan(activeSiteId, { limit: 100 })
      setMediaItems(result || [])
      setSelectedMedia([])
      setScanMode('all')
    } catch (err) {
      setError(err.message || 'Failed to scan all media')
    } finally {
      setScanning(false)
    }
  }

  const handleSuggestFolders = async () => {
    if (selectedMedia.length === 0) return
    setError('')
    setDismissedSuggestions(new Set())
    
    // Flatten folders for the AI
    const flatFolders = flattenTree(enrichTree(folders)).map(f => ({
      id: f.id,
      path: f.path,
    }))
    
    const itemsToProcess = mediaItems.filter(item => 
      selectedMedia.includes(item.id)
    )
    
    try {
      const { jobId } = await api.job.start({
        type: 'generate',
        siteId: activeSiteId,
        items: itemsToProcess,
        options: {
          withFolders: true,
          existingFolders: flatFolders,
        },
      })
      setCurrentJob({ jobId, status: 'running', total: itemsToProcess.length })
    } catch (err) {
      setError(err.message || 'Failed to start folder suggestion')
    }
  }

  const handleApplyFolderSuggestion = async (mediaItem) => {
    if (!mediaItem.suggestedFolder) return
    setError('')
    
    try {
      let folderId = mediaItem.suggestedFolder.folderId
      
      // If it's a new folder, create it first
      if (mediaItem.suggestedFolder.action === 'new' && mediaItem.suggestedFolder.newFolderPath) {
        const folder = await api.vmf.createPath(activeSiteId, mediaItem.suggestedFolder.newFolderPath)
        folderId = folder.id
        await loadFolders() // Refresh folder list
      }
      
      if (folderId) {
        await api.vmf.assign(activeSiteId, folderId, [mediaItem.id])
        // Remove from uncategorized list
        setMediaItems(prev => prev.filter(m => m.id !== mediaItem.id))
      }
    } catch (err) {
      setError(err.message || 'Failed to apply folder')
    }
  }

  const handleDismissSuggestion = (mediaId) => {
    setDismissedSuggestions(prev => new Set([...prev, mediaId]))
    // Clear the suggestion from the item
    setMediaItems(prev => prev.map(item => 
      item.id === mediaId ? { ...item, suggestedFolder: null } : item
    ))
  }

  const handleApplyAllForFolder = async (folderPath, isNew) => {
    const itemsForFolder = mediaItems.filter(item => 
      item.suggestedFolder && 
      !dismissedSuggestions.has(item.id) &&
      ((isNew && item.suggestedFolder.newFolderPath === folderPath) ||
       (!isNew && item.suggestedFolder.folderPath === folderPath))
    )
    
    if (itemsForFolder.length === 0) return
    setError('')
    
    try {
      let folderId
      
      if (isNew) {
        // Create the new folder
        const folder = await api.vmf.createPath(activeSiteId, folderPath)
        folderId = folder.id
        await loadFolders()
      } else {
        // Use existing folder ID from first item
        folderId = itemsForFolder[0].suggestedFolder.folderId
      }
      
      if (folderId) {
        const mediaIds = itemsForFolder.map(item => item.id)
        await api.vmf.assign(activeSiteId, folderId, mediaIds)
        // Remove from uncategorized list
        setMediaItems(prev => prev.filter(m => !mediaIds.includes(m.id)))
      }
    } catch (err) {
      setError(err.message || 'Failed to apply folder')
    }
  }

  const handleDismissFolder = (folderPath, isNew) => {
    const itemsForFolder = mediaItems.filter(item => 
      item.suggestedFolder &&
      ((isNew && item.suggestedFolder.newFolderPath === folderPath) ||
       (!isNew && item.suggestedFolder.folderPath === folderPath))
    )
    
    const newDismissed = new Set(dismissedSuggestions)
    itemsForFolder.forEach(item => newDismissed.add(item.id))
    setDismissedSuggestions(newDismissed)
    
    // Clear suggestions from items
    setMediaItems(prev => prev.map(item => 
      itemsForFolder.some(f => f.id === item.id) 
        ? { ...item, suggestedFolder: null } 
        : item
    ))
  }

  const handleApplyAllSuggestions = async () => {
    // Group items by folder (both existing and new)
    const existingFolders = new Map()
    const newFolders = new Map()
    
    mediaItems.forEach(item => {
      if (!item.suggestedFolder || dismissedSuggestions.has(item.id)) return
      
      if (item.suggestedFolder.newFolderPath) {
        const path = item.suggestedFolder.newFolderPath
        if (!newFolders.has(path)) newFolders.set(path, [])
        newFolders.get(path).push(item)
      } else if (item.suggestedFolder.folderId) {
        const id = item.suggestedFolder.folderId
        if (!existingFolders.has(id)) existingFolders.set(id, [])
        existingFolders.get(id).push(item)
      }
    })
    
    setError('')
    const appliedIds = []
    
    try {
      // Apply to existing folders
      for (const [folderId, items] of existingFolders) {
        const mediaIds = items.map(i => i.id)
        await api.vmf.assign(activeSiteId, folderId, mediaIds)
        appliedIds.push(...mediaIds)
      }
      
      // Create and apply to new folders
      for (const [folderPath, items] of newFolders) {
        const folder = await api.vmf.createPath(activeSiteId, folderPath)
        const mediaIds = items.map(i => i.id)
        await api.vmf.assign(activeSiteId, folder.id, mediaIds)
        appliedIds.push(...mediaIds)
      }
      
      // Refresh folders and remove applied items
      if (newFolders.size > 0) await loadFolders()
      setMediaItems(prev => prev.filter(m => !appliedIds.includes(m.id)))
    } catch (err) {
      setError(err.message || 'Failed to apply suggestions')
    }
  }

  const toggleMediaSelection = (id) => {
    setSelectedMedia(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const selectAllMedia = () => {
    setSelectedMedia(mediaItems.map(m => m.id))
  }

  const clearSelection = () => {
    setSelectedMedia([])
  }

  const toggleFolderExpanded = (folderId) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  // The folders from VMF API are already in tree format with children arrays
  // This function adds depth info and ensures path is set
  const enrichTree = (tree, depth = 0, parentPath = '') => {
    return tree.map((folder) => {
      const path = parentPath ? `${parentPath}/${folder.name}` : folder.name
      return {
        ...folder,
        depth,
        path: folder.path || path,
        children: folder.children?.length 
          ? enrichTree(folder.children, depth + 1, path) 
          : [],
      }
    })
  }

  const flattenTree = (tree, result = []) => {
    for (const node of tree) {
      result.push(node)
      if (node.children?.length) {
        flattenTree(node.children, result)
      }
    }
    return result
  }

  // Update uncategorized items with job results
  useEffect(() => {
    if (currentJob?.items) {
      setMediaItems(prev => prev.map(item => {
        const jobItem = currentJob.items.find(ji => ji.id === item.id)
        if (jobItem && jobItem.result && !dismissedSuggestions.has(item.id)) {
          return {
            ...item,
            suggestedFolder: {
              action: jobItem.result.action,
              folderId: jobItem.result.folderId,
              folderPath: jobItem.result.folderPath,
              newFolderPath: jobItem.result.newFolderPath,
              confidence: jobItem.result.confidence,
              reason: jobItem.result.reason,
              visualDescription: jobItem.result.visualDescription,
            },
          }
        }
        return item
      }))
    }
  }, [currentJob?.items, dismissedSuggestions])

  const folderTree = enrichTree(folders)
  const flatFolders = flattenTree(folderTree)

  // Group suggested folders
  const suggestedFolderGroups = useMemo(() => {
    const groups = { new: {}, existing: {} }
    
    mediaItems.forEach(item => {
      if (!item.suggestedFolder || dismissedSuggestions.has(item.id)) return
      
      if (item.suggestedFolder.action === 'new' && item.suggestedFolder.newFolderPath) {
        const path = item.suggestedFolder.newFolderPath
        if (!groups.new[path]) groups.new[path] = []
        groups.new[path].push(item)
      } else if (item.suggestedFolder.action === 'existing' && item.suggestedFolder.folderPath) {
        const path = item.suggestedFolder.folderPath
        if (!groups.existing[path]) groups.existing[path] = []
        groups.existing[path].push(item)
      }
    })
    
    return groups
  }, [mediaItems, dismissedSuggestions])

  const hasNewFolderSuggestions = Object.keys(suggestedFolderGroups.new).length > 0
  const hasExistingSuggestions = Object.keys(suggestedFolderGroups.existing).length > 0
  const hasAnySuggestions = hasNewFolderSuggestions || hasExistingSuggestions

  // Build preview tree: existing folders + new folders with their assigned images
  // Shows full paths inline (simpler than tree hierarchy)
  const previewTree = useMemo(() => {
    if (!hasAnySuggestions) return null
    
    // Create a map of all assignments (only folders with items)
    const assignments = new Map()
    
    // Add existing folder assignments
    Object.entries(suggestedFolderGroups.existing).forEach(([path, items]) => {
      assignments.set(path, { isNew: false, path, items })
    })
    
    // Add new folder assignments
    Object.entries(suggestedFolderGroups.new).forEach(([path, items]) => {
      assignments.set(path, { isNew: true, path, items })
    })
    
    // Sort by path for consistent display
    const sorted = Array.from(assignments.values()).sort((a, b) => 
      a.path.localeCompare(b.path)
    )
    
    return sorted
  }, [suggestedFolderGroups, hasAnySuggestions])

  // Render folder tree recursively
  const renderFolderNode = (folder) => {
    const hasChildren = folder.children?.length > 0
    const isExpanded = expandedFolders.has(folder.id)
    
    return (
      <div key={folder.id}>
        <div
          style={{
            padding: '8px 12px',
            paddingLeft: `${12 + folder.depth * 20}px`,
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: hasChildren ? 'pointer' : 'default',
          }}
          onClick={() => hasChildren && toggleFolderExpanded(folder.id)}
        >
          {hasChildren ? (
            <span style={{ width: '16px', textAlign: 'center' }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          ) : (
            <span style={{ width: '16px' }} />
          )}
          <span>📁</span>
          <span style={{ fontWeight: hasChildren ? 500 : 400 }}>{folder.name}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginLeft: 'auto' }}>
            {folder.path}
          </span>
        </div>
        {hasChildren && isExpanded && folder.children.map(child => renderFolderNode(child))}
      </div>
    )
  }

  if (!activeSiteId) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔗</div>
        <p>Please connect to a WordPress site first</p>
      </div>
    )
  }

  const handleInstallVmf = async () => {
    setInstallingVmf(true)
    setVmfInstallError('')
    try {
      await api.plugin.install(activeSiteId, 'virtual-media-folders')
      // Refresh site list to get updated capabilities
      const updatedSites = await api.site.list()
      setSites(updatedSites)
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('403') || msg.includes('Forbidden')) {
        setVmfInstallError('Permission denied. Your user needs administrator privileges to install plugins.')
      } else if (msg.includes('network-activate') || msg.includes('Network Admin')) {
        setVmfInstallError('Plugin cannot be activated via REST API. On Multisite, please network-activate the plugin via Network Admin → Plugins.')
      } else if (msg.includes('rest_cannot_manage_plugins')) {
        setVmfInstallError('Please install the plugin via Network Admin → Plugins.')
      } else {
        setVmfInstallError(msg || 'Failed to install plugin. Please install manually from WP Admin.')
      }
      console.error('[VMF Install Error]', err)
    } finally {
      setInstallingVmf(false)
    }
  }

  // Show loading state while checking VMF availability
  if (checkingVmf) {
    return (
      <div>
        <h1 className="page-title">Virtual Media Folders</h1>
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>
            Checking VMF plugin availability...
          </p>
        </div>
      </div>
    )
  }

  // Show VMF installation prompt if plugin not available
  if (!hasVmf) {
    return (
      <div>
        <h1 className="page-title">Virtual Media Folders</h1>
        
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <img 
            src={vmfIcon} 
            alt="VMF Plugin" 
            style={{ 
              width: '80px', 
              height: '80px', 
              marginBottom: '24px',
              opacity: 0.9,
            }} 
          />
          <h2 style={{ marginBottom: '12px' }}>VMF Plugin Required</h2>
          <p style={{ 
            color: 'var(--text-secondary)', 
            marginBottom: '24px',
            maxWidth: '400px',
            margin: '0 auto 24px',
          }}>
            The Virtual Media Folders plugin is not installed or activated on this WordPress site. 
            Install it to organize your media library into folders.
          </p>
          
          {vmfInstallError && (
            <div className="alert alert-error" style={{ 
              marginBottom: '16px', 
              textAlign: 'left',
              maxWidth: '400px',
              margin: '0 auto 16px',
            }}>
              {vmfInstallError}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={handleInstallVmf}
              disabled={installingVmf}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px',
              }}
            >
              {installingVmf ? (
                <>
                  <span className="spinner" style={{ width: '14px', height: '14px' }} />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <span>📦</span>
                  <span>Install & Activate VMF</span>
                </>
              )}
            </button>
            
            <a
              href="https://wordpress.org/plugins/virtual-media-folders/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px',
                textDecoration: 'none',
              }}
            >
              <span>Learn More</span>
              <span style={{ fontSize: '14px' }}>↗</span>
            </a>
          </div>
          
          <p style={{ 
            color: 'var(--text-tertiary)', 
            fontSize: '12px',
            marginTop: '16px',
          }}>
            Requires administrator privileges on the WordPress site.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Virtual Media Folders</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Media Scan Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title" style={{ marginBottom: 0 }}>
            📷 {scanMode === 'all' ? 'All Media' : 'Uncategorized Media'}
          </h2>
          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              onClick={handleScanUncategorized}
              disabled={scanning || isRunning}
            >
              {scanning && scanMode === 'uncategorized' ? '🔍 Scanning...' : '🔍 Scan Uncategorized'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleScanAll}
              disabled={scanning || isRunning}
            >
              {scanning && scanMode === 'all' ? '🔍 Scanning...' : '🔄 Scan All (Reorganize)'}
            </button>
          </div>
        </div>

        {mediaItems.length > 0 && (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-4 items-center">
                <span><strong>{mediaItems.length}</strong> {scanMode === 'all' ? 'images' : 'uncategorized'}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  <strong>{selectedMedia.length}</strong> selected
                </span>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={selectAllMedia}>
                  Select All
                </button>
                <button className="btn btn-secondary" onClick={clearSelection}>
                  Clear
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSuggestFolders}
                  disabled={selectedMedia.length === 0 || isRunning}
                >
                  🤖 Suggest Folders ({selectedMedia.length})
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
                    {currentJob.status === 'running' ? '⏳ Analyzing images...' : 
                     currentJob.status === 'completed' ? '✅ Completed' :
                     currentJob.status}
                  </span>
                  <span>{currentJob.completed || 0} / {currentJob.total}</span>
                </div>
                <ProgressBar value={currentJob.completed || 0} max={currentJob.total} />
              </div>
            )}

            {/* Assignment Preview - shown inline during/after analysis */}
            {hasAnySuggestions && previewTree && (
              <div style={{ 
                marginBottom: '16px',
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
              }}>
                <div style={{ 
                  padding: '12px 16px', 
                  background: 'var(--bg-tertiary)', 
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                    🗺️ Assignment Preview
                  </h3>
                  <button
                    className="btn btn-primary"
                    onClick={handleApplyAllSuggestions}
                    disabled={isRunning}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    ✓ Apply All Suggestions
                  </button>
                </div>
                {previewTree.map(({ isNew, path, items }) => {
                  const pathParts = path.split('/')
                  
                  return (
                    <div key={path}>
                      {/* Folder row with full path */}
                      <div
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--border)',
                          background: isNew ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                        }}
                      >
                        <span>{isNew ? '✨' : '📁'}</span>
                        {/* Show path with breadcrumbs */}
                        <span style={{ 
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          {pathParts.map((part, idx) => (
                            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {idx > 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>/</span>}
                              <span style={{ 
                                color: idx === pathParts.length - 1 
                                  ? (isNew ? 'var(--accent)' : 'inherit')
                                  : 'var(--text-secondary)',
                              }}>
                                {part}
                              </span>
                            </span>
                          ))}
                        </span>
                        {isNew && (
                          <span style={{ 
                            fontSize: '10px', 
                            background: 'var(--accent)', 
                            color: 'white',
                            padding: '1px 5px',
                            borderRadius: '3px',
                          }}>
                            NEW
                          </span>
                        )}
                        <span style={{ 
                          color: 'var(--text-secondary)', 
                          fontSize: '11px', 
                          marginLeft: 'auto' 
                        }}>
                          {items.length}
                        </span>
                      </div>
                      {/* Thumbnails row */}
                      <div style={{
                        padding: '8px 12px 8px 32px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                      }}>
                        {items.slice(0, 10).map(item => (
                          <img
                            key={item.id}
                            src={item.thumbnailUrl || item.sourceUrl}
                            alt={item.filename || ''}
                            title={item.filename || item.title}
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewImage(item)
                            }}
                            style={{
                              width: '40px',
                              height: '40px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                              cursor: 'pointer',
                            }}
                          />
                        ))}
                        {items.length > 10 && (
                          <span style={{
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            background: 'var(--bg-tertiary)',
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                          }}>
                            +{items.length - 10}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Uncategorized Media Grid - hide during analysis and when suggestions exist */}
            {!isRunning && !hasAnySuggestions && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                gap: '12px' 
              }}>
              {mediaItems.map(item => {
                const targetFolder = item.suggestedFolder?.action === 'existing' 
                  ? item.suggestedFolder.folderPath 
                  : item.suggestedFolder?.action === 'new'
                    ? item.suggestedFolder.newFolderPath
                    : null
                
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleMediaSelection(item.id)}
                    style={{
                      border: `2px solid ${selectedMedia.includes(item.id) ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: 'var(--bg-card)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', padding: '10px' }}>
                      <img
                        src={item.thumbnailUrl || item.sourceUrl}
                        alt={item.currentAlt || ''}
                        style={{ 
                          width: '60px', 
                          height: '60px', 
                          objectFit: 'cover',
                          borderRadius: '4px',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontSize: '13px',
                          fontWeight: 500, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap' 
                        }}>
                          {item.filename || item.title}
                        </div>
                        {item.suggestedFolder && (
                          <div style={{ marginTop: '6px' }}>
                            {item.suggestedFolder.action === 'skip' ? (
                              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                ⏭️ Skip
                              </div>
                            ) : (
                              <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                background: item.suggestedFolder.action === 'new' 
                                  ? 'rgba(99, 102, 241, 0.15)' 
                                  : 'rgba(34, 197, 94, 0.15)',
                                borderRadius: '4px',
                                fontSize: '12px',
                              }}>
                                <span>{item.suggestedFolder.action === 'new' ? '✨' : '📁'}</span>
                                <span style={{ 
                                  color: item.suggestedFolder.action === 'new' 
                                    ? 'var(--accent)' 
                                    : 'var(--success)',
                                  fontWeight: 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {targetFolder}
                                </span>
                                {item.suggestedFolder.action === 'new' && (
                                  <span style={{ 
                                    fontSize: '9px', 
                                    background: 'var(--accent)', 
                                    color: 'white',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    marginLeft: 'auto',
                                    flexShrink: 0,
                                  }}>
                                    NEW
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>
            )}
          </>
        )}

        {!scanning && mediaItems.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
            Click "Scan Uncategorized" to find media without folders
          </p>
        )}
      </div>

      {/* Create Folder Section */}
      <div className="card">
        <h2 className="card-title">➕ Create Folder</h2>

        <div className="flex gap-2 items-end">
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">Folder Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0, width: '200px' }}>
            <label className="form-label">Parent</label>
            <select
              className="form-input"
              value={selectedParent}
              onChange={(e) => setSelectedParent(e.target.value)}
            >
              <option value="">Root</option>
              {flatFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {'—'.repeat(folder.depth)} {folder.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim() || creating}
          >
            {creating ? 'Creating...' : '+ Create'}
          </button>
        </div>
      </div>

      {/* Folder Hierarchy Section - Collapsible */}
      <div className="card">
        <div 
          className="flex justify-between items-center"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowHierarchy(!showHierarchy)}
        >
          <h2 className="card-title" style={{ marginBottom: 0 }}>
            <span style={{ marginRight: '8px' }}>{showHierarchy ? '▼' : '▶'}</span>
            🗂️ Folder Hierarchy
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 'normal', marginLeft: '8px' }}>
              ({folders.length} folders)
            </span>
          </h2>
          <button
            className="btn btn-secondary"
            onClick={(e) => {
              e.stopPropagation()
              loadFolders()
            }}
            disabled={loading}
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>

        {showHierarchy && (
          <div style={{ marginTop: '16px' }}>
            {loading && folders.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading folders...</p>
            ) : folders.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-state-icon">📁</div>
                <p>No folders yet. Create one above.</p>
              </div>
            ) : (
              <div style={{ 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
              }}>
                {folderTree.map(folder => renderFolderNode(folder))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer',
            padding: '40px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              cursor: 'default',
            }}
          >
            <img
              src={previewImage.sourceUrl}
              alt={previewImage.filename || ''}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(90vh - 60px)',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
            <div style={{
              textAlign: 'center',
              color: 'white',
              fontSize: '14px',
            }}>
              <div style={{ fontWeight: 500 }}>{previewImage.filename || previewImage.title}</div>
              {previewImage.suggestedFolder && (
                <div style={{ 
                  marginTop: '4px', 
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '13px',
                }}>
                  → {previewImage.suggestedFolder.folderPath || previewImage.suggestedFolder.newFolderPath}
                </div>
              )}
            </div>
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                alignSelf: 'center',
                padding: '8px 24px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
