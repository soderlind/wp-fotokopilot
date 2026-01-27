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
      const error = new Error(`VMF API error: ${response.status}`)
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

      return request(`/folders/${folderId}/media`, {
        method: 'POST',
        body: JSON.stringify({ media_ids: ids }),
      })
    },

    async removeMedia(folderId, mediaIds) {
      const ids = Array.isArray(mediaIds) ? mediaIds : [mediaIds]

      return request(`/folders/${folderId}/media`, {
        method: 'DELETE',
        body: JSON.stringify({ media_ids: ids }),
      })
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
  }
}
