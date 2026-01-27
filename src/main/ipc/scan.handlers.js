import { createWpClient } from '../services/wp-client.js'
import { getCredentials } from '../services/credential-store.js'

let scanController

export function scanHandlers(mainWindow) {
  return [
    {
      channel: 'scan:start',
      async handler({ siteId, missingAltOnly = false, limit }) {
        const credentials = await getCredentials(siteId)
        if (!credentials) throw new Error('Site not found')

        const client = createWpClient(credentials)
        scanController = new AbortController()
        const items = []

        try {
          for await (const item of client.scanMedia({ missingAltOnly, limit })) {
            if (scanController.signal.aborted) break
            items.push(item)
            mainWindow.webContents.send('scan:item', item)
          }
        } catch (error) {
          if (error.name !== 'AbortError') throw error
        }

        mainWindow.webContents.send('scan:complete', { total: items.length })
        return items
      },
    },
    {
      channel: 'scan:cancel',
      async handler() {
        scanController?.abort()
        return { cancelled: true }
      },
    },
  ]
}
