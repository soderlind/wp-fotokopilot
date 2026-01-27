import { useState, useEffect } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'
import { useAppStore } from '../stores/appStore'

export default function FoldersTab() {
  const api = useElectronAPI()
  const activeSiteId = useAppStore((state) => state.activeSiteId)
  const folders = useAppStore((state) => state.folders)
  const setFolders = useAppStore((state) => state.setFolders)
  const addFolder = useAppStore((state) => state.addFolder)
  const mediaItems = useAppStore((state) => state.mediaItems)
  const selectedItems = useAppStore((state) => state.selectedItems)
  const sites = useAppStore((state) => state.sites)

  const [selectedFolder, setSelectedFolder] = useState(undefined)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderPath, setNewFolderPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeSite = sites.find((s) => s.id === activeSiteId)
  const hasVmf = activeSite?.capabilities?.vmf

  useEffect(() => {
    if (activeSiteId && hasVmf) {
      loadFolders()
    }
  }, [activeSiteId, hasVmf])

  const loadFolders = async () => {
    setLoading(true)
    try {
      const tree = await api.vmf.list(activeSiteId)
      setFolders(flattenTree(tree))
    } catch (err) {
      setError(err.message || 'Failed to load folders')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName) return
    setError('')
    try {
      const folder = await api.vmf.create(
        activeSiteId,
        newFolderName,
        selectedFolder?.id || 0
      )
      addFolder(folder)
      setNewFolderName('')
      loadFolders()
    } catch (err) {
      setError(err.message || 'Failed to create folder')
    }
  }

  const handleCreatePath = async () => {
    if (!newFolderPath) return
    setError('')
    try {
      await api.vmf.createPath(activeSiteId, newFolderPath)
      setNewFolderPath('')
      loadFolders()
    } catch (err) {
      setError(err.message || 'Failed to create folder path')
    }
  }

  const handleAssign = async () => {
    if (!selectedFolder || selectedItems.length === 0) return
    setError('')
    try {
      await api.vmf.assign(activeSiteId, selectedFolder.id, selectedItems)
      alert(`Assigned ${selectedItems.length} items to "${selectedFolder.name}"`)
    } catch (err) {
      setError(err.message || 'Failed to assign media')
    }
  }

  if (!activeSiteId) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔗</div>
        <p>Please connect to a WordPress site first</p>
      </div>
    )
  }

  if (!hasVmf) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📁</div>
        <p>
          Virtual Media Folders plugin is not installed on this site.
          <br />
          <a
            href="https://github.com/soderlind/virtual-media-folders"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)' }}
          >
            Learn more about VMF
          </a>
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Virtual Media Folders</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="flex gap-4">
        <div className="card" style={{ flex: 1 }}>
          <h2 className="card-title">Folder Tree</h2>
          {loading ? (
            <p>Loading folders...</p>
          ) : folders.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>
              No folders yet. Create one below.
            </p>
          ) : (
            <ul className="folder-tree">
              {folders.map((folder) => (
                <li
                  key={folder.id}
                  className={`folder-item ${
                    selectedFolder?.id === folder.id ? 'selected' : ''
                  }`}
                  style={{ paddingLeft: `${(folder.depth || 0) * 20 + 12}px` }}
                  onClick={() => setSelectedFolder(folder)}
                >
                  📁 {folder.name}
                  {folder.count !== undefined && (
                    <span style={{ opacity: 0.5, marginLeft: 8 }}>
                      ({folder.count})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <div className="form-group">
              <label className="form-label">New folder name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleCreateFolder}
                  disabled={!newFolderName}
                >
                  Create
                </button>
              </div>
              {selectedFolder && (
                <small style={{ color: 'var(--text-secondary)' }}>
                  Will be created inside: {selectedFolder.name}
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Create from path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Category/Subcategory/Leaf"
                  value={newFolderPath}
                  onChange={(e) => setNewFolderPath(e.target.value)}
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleCreatePath}
                  disabled={!newFolderPath}
                >
                  Create Path
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ flex: 1 }}>
          <h2 className="card-title">Assign Media</h2>
          {selectedItems.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>
              Select media items from the Scan or Review tab first.
            </p>
          ) : (
            <>
              <p className="mb-4">
                <strong>{selectedItems.length}</strong> items selected
              </p>
              <button
                className="btn btn-primary"
                onClick={handleAssign}
                disabled={!selectedFolder}
              >
                Move to "{selectedFolder?.name || 'Select a folder'}"
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function flattenTree(tree, depth = 0) {
  const result = []
  for (const folder of tree) {
    result.push({ ...folder, depth })
    if (folder.children?.length) {
      result.push(...flattenTree(folder.children, depth + 1))
    }
  }
  return result
}
