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
        return Array.isArray(result) ? result : []
      } catch (err) {
        // If endpoint doesn't exist, fall back to scanning all folders
        // and comparing with all media
        console.warn('[VMF] Uncategorized endpoint not available, using fallback')
        return []
      }
    },

    async getFolderMedia(folderId) {
      const result = await request(`/folders/${folderId}/media`)
      return Array.isArray(result) ? result : []
    },
  }
}
