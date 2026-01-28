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
        const vmfClient = await getVmfClient(siteId)
        const credentials = await getCredentials(siteId)
        const baseUrl = credentials.url.replace(/\/$/, '')
        const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`
        
        // First try VMF's uncategorized endpoint (most reliable if it exists)
        try {
          const vmfResult = await vmfClient.getUncategorizedMedia(limit)
          if (vmfResult && vmfResult.length > 0) {
            console.log(`[VMF] Got ${vmfResult.length} uncategorized items from VMF API`)
            return vmfResult
          }
        } catch (err) {
          console.log('[VMF] Uncategorized endpoint not available:', err.message)
        }
        
        // Fall back: Get all media with embedded terms and check vmfo_folder taxonomy
        console.log('[VMF] Using fallback: checking embedded taxonomy terms on each media item')
        
        // Get folder info for logging
        const folderInfo = await vmfClient.getAllAssignedMediaIds()
        console.log(`[VMF] ${folderInfo.totalAssigned} media assignments expected across ${folderInfo.folderCount} folders`)
        
        // Get all media from WordPress with _embed to include taxonomy terms
        const uncategorized = []
        let page = 1
        let totalChecked = 0
        let totalAssigned = 0
        const perPage = 100
        
        while (uncategorized.length < limit) {
          try {
            const response = await fetch(
              `${baseUrl}/wp-json/wp/v2/media?per_page=${perPage}&page=${page}&media_type=image&_embed`,
              { headers: { Authorization: authHeader } }
            )
            
            if (!response.ok) break
            
            const data = await response.json()
            if (data.length === 0) break
            
            for (const item of data) {
              totalChecked++
              
              // Check embedded terms for vmfo_folder taxonomy
              // _embedded['wp:term'] is an array of arrays, one for each registered taxonomy
              let hasFolderAssignment = false
              const embeddedTerms = item._embedded?.['wp:term'] || []
              for (const termArray of embeddedTerms) {
                if (Array.isArray(termArray)) {
                  for (const term of termArray) {
                    if (term.taxonomy === 'vmfo_folder') {
                      hasFolderAssignment = true
                      break
                    }
                  }
                }
                if (hasFolderAssignment) break
              }
              
              // Also check direct vmfo_folder field as fallback
              if (!hasFolderAssignment) {
                const directTerms = item.vmfo_folder || item['vmfo-folder'] || []
                hasFolderAssignment = Array.isArray(directTerms) && directTerms.length > 0
              }
              
              if (hasFolderAssignment) {
                totalAssigned++
              } else {
                if (uncategorized.length < limit) {
                  uncategorized.push({
                    id: item.id,
                    sourceUrl: item.source_url,
                    thumbnailUrl: item.media_details?.sizes?.thumbnail?.source_url ||
                      item.media_details?.sizes?.medium?.source_url,
                    filename: item.slug,
                    title: item.title?.rendered || '',
                    currentAlt: item.alt_text || '',
                    caption: item.caption?.rendered || '',
                    mimeType: item.mime_type,
                  })
                }
              }
            }
            
            const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1')
            if (page >= totalPages || uncategorized.length >= limit) break
            
            page++
          } catch (err) {
            console.error('[VMF] Error fetching media:', err.message)
            break
          }
        }
        
        console.log(`[VMF] Checked ${totalChecked} media items: ${totalAssigned} assigned, ${uncategorized.length} uncategorized`)
        
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
