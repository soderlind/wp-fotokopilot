import { createVmfClient } from '../services/vmf-client.js'
import { getCredentials } from '../services/credential-store.js'
import { createWpClient } from '../services/wp-client.js'

export function vmfHandlers(mainWindow) {
  async function getVmfClient(siteId) {
    const credentials = await getCredentials(siteId)
    if (!credentials) throw new Error('Site not found')
    return createVmfClient(credentials)
  }

  async function getWpClient(siteId) {
    const credentials = await getCredentials(siteId)
    if (!credentials) throw new Error('Site not found')
    return createWpClient(credentials)
  }

  return [
    {
      channel: 'vmf:list',
      async handler({ siteId }) {
        const client = await getVmfClient(siteId)
        return client.listFolders()
      },
    },
    {
      channel: 'vmf:create',
      async handler({ siteId, name, parentId }) {
        const client = await getVmfClient(siteId)
        return client.createFolder(name, parentId)
      },
    },
    {
      channel: 'vmf:createPath',
      async handler({ siteId, path }) {
        const client = await getVmfClient(siteId)
        return client.createFolderPath(path)
      },
    },
    {
      channel: 'vmf:assign',
      async handler({ siteId, folderId, mediaIds }) {
        const client = await getVmfClient(siteId)
        return client.assignMedia(folderId, mediaIds)
      },
    },
    {
      channel: 'vmf:uncategorized',
      async handler({ siteId, limit = 50 }) {
        const wpClient = await getWpClient(siteId)
        
        // Query media not assigned to any vmfo_folder taxonomy term
        // WordPress REST API supports filtering by taxonomy with empty value
        const uncategorized = await wpClient.getUncategorizedMedia(limit)
        
        return uncategorized
      },
    },
    {
      channel: 'media:scan',
      async handler({ siteId, limit = 100 }) {
        const wpClient = await getWpClient(siteId)
        
        // Scan all media (for reorganization)
        const results = []
        for await (const item of wpClient.scanMedia({ limit })) {
          results.push(item)
        }
        
        return results
      },
    },
  ]
}
