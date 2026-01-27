import { getCredentials, saveCredentials, deleteCredentials, listSites } from '../services/credential-store.js'
import { createWpClient } from '../services/wp-client.js'

export function siteHandlers(mainWindow) {
  return [
    {
      channel: 'site:add',
      async handler({ id, url, username, password }) {
        const client = createWpClient({ url, username, password })
        const info = await client.testConnection()
        await saveCredentials(id, { url, username, password, ...info })
        return { id, ...info }
      },
    },
    {
      channel: 'site:remove',
      async handler(id) {
        await deleteCredentials(id)
        return { success: true }
      },
    },
    {
      channel: 'site:list',
      async handler() {
        return listSites()
      },
    },
    {
      channel: 'site:test',
      async handler({ url, username, password }) {
        const client = createWpClient({ url, username, password })
        return client.testConnection()
      },
    },
    {
      channel: 'site:get',
      async handler(id) {
        return getCredentials(id)
      },
    },
  ]
}
