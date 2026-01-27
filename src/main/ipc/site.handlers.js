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
    {
      channel: 'plugin:install',
      async handler({ siteId, slug }) {
        const creds = await getCredentials(siteId)
        if (!creds) throw new Error('Site not found')
        const client = createWpClient(creds)
        
        let result
        try {
          result = await client.installPlugin(slug)
        } catch (err) {
          console.log(`[Plugin] Install error:`, err.code, err.message)
          
          // If plugin already exists, try to activate it
          if (err.code === 'folder_exists' || err.message?.includes('exists')) {
            console.log(`[Plugin] ${slug} already installed, listing all plugins...`)
            
            // Find the actual plugin identifier by listing all plugins
            let plugin
            try {
              const allPlugins = await client.listPlugins()
              console.log(`[Plugin] Found ${allPlugins.length} plugins:`, allPlugins.map(p => p.plugin))
              plugin = allPlugins.find(p => p.plugin.startsWith(`${slug}/`))
            } catch (listErr) {
              console.error('[Plugin] Failed to list plugins:', listErr)
              throw new Error(
                'Cannot list plugins. On WordPress Multisite, plugins are managed at the network level. ' +
                'Please activate the plugin via Network Admin → Plugins.'
              )
            }
            
            if (!plugin) {
              throw new Error(
                `Plugin folder exists but plugin not found in REST API. ` +
                `On Multisite, the plugin may need to be network-activated via Network Admin.`
              )
            }
            
            console.log(`[Plugin] Found plugin: ${plugin.plugin}, status: ${plugin.status}`)
            
            if (plugin.status === 'active') {
              // Already active
              result = { status: 'active', name: plugin.name, alreadyActive: true }
            } else {
              // Try to activate
              try {
                result = await client.activatePlugin(plugin.plugin)
                result.name = plugin.name
                result.alreadyInstalled = true
              } catch (activateErr) {
                console.error('[Plugin] Activation failed:', activateErr)
                if (activateErr.message?.includes('not_found')) {
                  throw new Error(
                    'Plugin cannot be activated via REST API. On Multisite, please network-activate the plugin via Network Admin → Plugins.'
                  )
                }
                throw new Error(`Plugin is installed but activation failed: ${activateErr.message}`)
              }
            }
          } else {
            throw err
          }
        }
        
        // Update site capabilities after installing/activating VMF
        if (slug === 'virtual-media-folders') {
          const info = await client.testConnection()
          await saveCredentials(siteId, { ...creds, ...info })
        }
        
        return result
      },
    },
  ]
}
