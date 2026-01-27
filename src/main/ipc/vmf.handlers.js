import { createVmfClient } from '../services/vmf-client.js'
import { getCredentials } from '../services/credential-store.js'

export function vmfHandlers(mainWindow) {
  async function getVmfClient(siteId) {
    const credentials = await getCredentials(siteId)
    if (!credentials) throw new Error('Site not found')
    return createVmfClient(credentials)
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
  ]
}
