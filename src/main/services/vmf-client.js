/**
 * @fileoverview Virtual Media Folders (VMF) REST API client.
 * Handles folder management and media organization for WordPress.
 * @module main/services/vmf-client
 */

/**
 * @typedef {Object} VmfFolder
 * @property {number} id - Folder ID
 * @property {string} name - Folder name
 * @property {number} parentId - Parent folder ID (0 for root)
 * @property {number} count - Number of media items
 * @property {VmfFolder[]} children - Child folders
 * @property {string} path - Full folder path
 */

/**
 * Creates a VMF REST API client.
 * @param {Object} credentials - WordPress site credentials
 * @param {string} credentials.url - WordPress site URL
 * @param {string} credentials.username - WordPress username
 * @param {string} credentials.password - Application password
 * @returns {Object} VMF client with API methods
 */
export function createVmfClient({ url, username, password }) {
  const baseUrl = url.replace(/\/$/, '')
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

  /**
   * Makes an authenticated request to the VMF REST API.
   * @private
   * @param {string} endpoint - API endpoint path
   * @param {Object} [options] - Fetch options
   * @returns {Promise<any>} Parsed JSON response
   * @throws {Error} For API errors
   */
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

  /**
   * Makes an authenticated request to the WordPress standard REST API.
   * @private
   * @param {string} endpoint - API endpoint path
   * @returns {Promise<{data: any, headers: Headers}>}
   */
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

  /**
   * Builds a hierarchical tree from flat folder list.
   * @private
   * @param {Array} flatFolders - Flat array of folders from API
   * @returns {VmfFolder[]} Hierarchical folder tree
   */
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

  /**
   * Finds a folder by name and parent ID in the tree.
   * @private
   * @param {VmfFolder[]} tree - Folder tree to search
   * @param {string} name - Folder name to find
   * @param {number} parentId - Expected parent ID
   * @returns {VmfFolder|undefined}
   */
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
    /**
     * Lists all folders as a hierarchical tree.
     * @returns {Promise<VmfFolder[]>}
     */
    async listFolders() {
      const folders = await request('/folders')
      return buildFolderTree(Array.isArray(folders) ? folders : [])
    },

    /**
     * Creates a new folder.
     * @param {string} name - Folder name
     * @param {number} [parentId=0] - Parent folder ID
     * @returns {Promise<VmfFolder>}
     */
    async createFolder(name, parentId = 0) {
      return request('/folders', {
        method: 'POST',
        body: JSON.stringify({ name, parent: parentId }),
      })
    },

    /**
     * Creates a folder path, creating any missing parent folders.
     * @param {string} path - Folder path like "Category/Subcategory"
     * @returns {Promise<VmfFolder>} The deepest folder
     */
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

    /**
     * Assigns media items to a folder.
     * @param {number} folderId - Target folder ID
     * @param {number|number[]} mediaIds - Media ID(s) to assign
     * @returns {Promise<Array>} Assignment results
     */
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

    /**
     * Removes media items from a folder.
     * @param {number} folderId - Folder ID
     * @param {number|number[]} mediaIds - Media ID(s) to remove
     * @returns {Promise<Array>} Removal results
     */
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

    /**
     * Gets a single folder by ID.
     * @param {number} folderId - Folder ID
     * @returns {Promise<VmfFolder>}
     */
    async getFolder(folderId) {
      return request(`/folders/${folderId}`)
    },

    /**
     * Deletes a folder.
     * @param {number} folderId - Folder ID
     * @returns {Promise<void>}
     */
    async deleteFolder(folderId) {
      return request(`/folders/${folderId}`, { method: 'DELETE' })
    },

    /**
     * Gets folder counts from the VMF API.
     * @returns {Promise<Object>}
     */
    async getFolderCounts() {
      return request('/folders/counts')
    },

    /**
     * Gets media not assigned to any folder via VMF's uncategorized endpoint.
     * @param {number} [limit=50] - Maximum items to return
     * @returns {Promise<Array>} Uncategorized media items
     * @throws {Error} If endpoint not available
     */
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

    /**
     * Gets media items in a specific folder.
     * Note: VMF doesn't have a GET endpoint for this, returns empty.
     * @deprecated Use getAllAssignedMediaIds and check taxonomy instead
     * @param {number} folderId - Folder ID
     * @returns {Promise<Array>} Always empty
     */
    async getFolderMedia(folderId) {
      // VMF doesn't have a GET endpoint for folder media
      // Return empty - use getAllAssignedMediaIds instead
      console.warn('[VMF] getFolderMedia not supported, use getAllAssignedMediaIds')
      return []
    },

    /**
     * Gets information about all assigned media.
     * Returns folder count info, not actual media IDs.
     * Actual filtering should check vmfo_folder taxonomy on each media item.
     * @returns {Promise<{folderCount: number, totalAssigned: number, folderIds: number[]}>}
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
