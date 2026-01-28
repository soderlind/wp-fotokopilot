export function createVmfClient({ url, username, password }) {
  const baseUrl = url.replace(/\/$/, '')
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

  async function request(endpoint, options = {}) {
    const fullUrl = `${baseUrl}/wp-json/vmfo/v1${endpoint}`

    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      // Try to get error details from response body
      let errorMessage = `VMF API error: ${response.status}`
      try {
        const errorBody = await response.text()
        if (errorBody) {
          const errorData = JSON.parse(errorBody)
          errorMessage = errorData.message || errorData.error || errorMessage
          console.error('[VMF] API Error:', errorData)
        }
      } catch {
        // Ignore parse errors
      }
      const error = new Error(errorMessage)
      error.code = 'VMF_ERROR'
      error.status = response.status
      throw error
    }

    const text = await response.text()
    return text ? JSON.parse(text) : {}
  }

  // Helper to make requests to WordPress standard REST API (for media queries)
  async function wpRequest(endpoint) {
    const fullUrl = `${baseUrl}/wp-json${endpoint}`

    const response = await fetch(fullUrl, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      let errorMessage = `WP API error: ${response.status}`
      try {
        const errorBody = await response.text()
        if (errorBody) {
          const errorData = JSON.parse(errorBody)
          errorMessage = errorData.message || errorData.error || errorMessage
        }
      } catch {
        // Ignore parse errors
      }
      const error = new Error(errorMessage)
      error.code = 'WP_ERROR'
      error.status = response.status
      throw error
    }

    return {
      data: await response.json(),
      headers: response.headers,
    }
  }

  function buildFolderTree(flatFolders) {
    const map = new Map()
    const roots = []

    for (const folder of flatFolders) {
      map.set(folder.id, {
        id: folder.id,
        name: folder.name,
        parentId: folder.parent || 0,
        count: folder.count || 0,
        children: [],
        path: folder.name,
      })
    }

    for (const folder of map.values()) {
      if (folder.parentId && map.has(folder.parentId)) {
        const parent = map.get(folder.parentId)
        parent.children.push(folder)
        folder.path = `${parent.path}/${folder.name}`
      } else {
        roots.push(folder)
      }
    }

    return roots
  }

  function findFolderByNameAndParent(tree, name, parentId) {
    const search = (folders, currentParent) => {
      for (const folder of folders) {
        const matchesParent = parentId === 0
          ? folder.parentId === 0 || !folder.parentId
          : folder.parentId === parentId

        if (folder.name.toLowerCase() === name.toLowerCase() && matchesParent) {
          return folder
        }

        if (folder.children?.length) {
          const found = search(folder.children, folder.id)
          if (found) return found
        }
      }
      return undefined
    }

    return search(tree, 0)
  }

  return {
    async listFolders() {
      const folders = await request('/folders')
      return buildFolderTree(Array.isArray(folders) ? folders : [])
    },

    async createFolder(name, parentId = 0) {
      return request('/folders', {
        method: 'POST',
        body: JSON.stringify({ name, parent: parentId }),
      })
    },

    async createFolderPath(path) {
      const parts = path.split('/').filter(Boolean)
      let parentId = 0
      let currentFolder

      const existingTree = await this.listFolders()

      for (const name of parts) {
        const found = findFolderByNameAndParent(existingTree, name, parentId)

        if (found) {
          currentFolder = found
          parentId = found.id
        } else {
          currentFolder = await this.createFolder(name, parentId)
          parentId = currentFolder.id
        }
      }

      return currentFolder
    },

    async assignMedia(folderId, mediaIds) {
      const ids = Array.isArray(mediaIds) ? mediaIds : [mediaIds]
      console.log(`[VMF] Assigning media ${JSON.stringify(ids)} to folder ${folderId}`)

      // VMF API expects one media_id at a time
      const results = []
      for (const mediaId of ids) {
        const result = await request(`/folders/${folderId}/media`, {
          method: 'POST',
          body: JSON.stringify({ media_id: mediaId }),
        })
        results.push(result)
      }
      return results
    },

    async removeMedia(folderId, mediaIds) {
      const ids = Array.isArray(mediaIds) ? mediaIds : [mediaIds]

      // VMF API expects one media_id at a time
      const results = []
      for (const mediaId of ids) {
        const result = await request(`/folders/${folderId}/media`, {
          method: 'DELETE',
          body: JSON.stringify({ media_id: mediaId }),
        })
        results.push(result)
      }
      return results
    },

    async getFolder(folderId) {
      return request(`/folders/${folderId}`)
    },

    async deleteFolder(folderId) {
      return request(`/folders/${folderId}`, { method: 'DELETE' })
    },

    async getFolderCounts() {
      return request('/folders/counts')
    },

    async getUncategorizedMedia(limit = 50) {
      // Get media that is not assigned to any folder
      // This uses the VMF API endpoint for uncategorized media
      try {
        const result = await request(`/media/uncategorized?per_page=${limit}`)
        const items = Array.isArray(result) ? result : []
        
        // Map VMF response to our standard media format
        return items.map(item => ({
          id: item.id,
          sourceUrl: item.source_url || item.sourceUrl,
          thumbnailUrl: item.thumbnail_url || item.thumbnailUrl || 
            item.media_details?.sizes?.thumbnail?.source_url ||
            item.media_details?.sizes?.medium?.source_url,
          filename: item.slug || item.filename,
          title: item.title?.rendered || item.title || '',
          currentAlt: item.alt_text || item.alt || '',
          caption: item.caption?.rendered || item.caption || '',
          mimeType: item.mime_type || item.mimeType,
        }))
      } catch (err) {
        // If endpoint doesn't exist, return empty array and let caller fall back
        console.warn('[VMF] Uncategorized endpoint not available:', err.message)
        throw err
      }
    },

    async getFolderMedia(folderId) {
      // VMF doesn't have a GET endpoint for folder media
      // Return empty - use getAllAssignedMediaIds instead
      console.warn('[VMF] getFolderMedia not supported, use getAllAssignedMediaIds')
      return []
    },

    /**
     * Get all media IDs that are assigned to any folder.
     * Uses the folder counts from VMF API - doesn't need to query each folder.
     * The actual filtering is done by checking the vmfo_folder taxonomy on each media item.
     */
    async getAllAssignedMediaIds() {
      // Get all folders with their counts
      const folders = await request('/folders')
      const folderList = Array.isArray(folders) ? folders : []
      
      // Sum up all folder counts to know how many media are assigned
      const totalAssigned = folderList.reduce((sum, f) => sum + (f.count || 0), 0)
      console.log(`[VMF] Folders report ${totalAssigned} total media assignments across ${folderList.length} folders`)
      
      // Return folder count info - the actual filtering will be done by checking
      // the vmfo_folder field on each media item in the handler
      return {
        folderCount: folderList.length,
        totalAssigned,
        folderIds: folderList.map(f => f.id),
      }
    },
  }
}
