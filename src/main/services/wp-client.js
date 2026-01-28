export function createWpClient({ url, username, password }) {
  const baseUrl = url.replace(/\/$/, '')
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

  async function request(endpoint, options = {}) {
    const fullUrl = `${baseUrl}/wp-json${endpoint}`
    
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const error = new Error('Rate limited')
      error.code = 'RATE_LIMITED'
      error.retryAfter = retryAfter ? parseInt(retryAfter) : 60
      throw error
    }

    if (response.status === 401) {
      const error = new Error('Unauthorized - check your credentials')
      error.code = 'UNAUTHORIZED'
      throw error
    }

    if (response.status === 403) {
      const error = new Error('Forbidden - insufficient permissions')
      error.code = 'FORBIDDEN'
      throw error
    }

    if (!response.ok) {
      // Try to get error details from response body
      let errorMessage = `WordPress API error: ${response.status}`
      let errorData = null
      try {
        errorData = await response.json()
        if (errorData.message) {
          errorMessage = errorData.message
        }
        if (errorData.code) {
          errorMessage = `${errorData.code}: ${errorMessage}`
        }
      } catch {
        // Response wasn't JSON
      }
      
      const error = new Error(errorMessage)
      error.code = errorData?.code || 'WP_ERROR'
      error.status = response.status
      error.data = errorData
      throw error
    }

    return {
      data: await response.json(),
      headers: response.headers,
    }
  }

  return {
    async testConnection() {
      const { data } = await request('/')
      
      let vmfAvailable = false
      try {
        await request('/vmfo/v1/folders')
        vmfAvailable = true
      } catch {
        vmfAvailable = false
      }

      return {
        name: data.name,
        description: data.description,
        url: data.url,
        locale: data.language || 'en_US',
        capabilities: {
          rest: true,
          vmf: vmfAvailable,
        },
      }
    },

    async getSiteLocale() {
      const { data } = await request('/')
      return data.language || 'en_US'
    },

    getLanguageName(locale) {
      // Map WordPress locale codes to human-readable language names
      const languageMap = {
        en_US: 'English',
        en_GB: 'English',
        en_AU: 'English',
        nb_NO: 'Norwegian (Bokmål)',
        nn_NO: 'Norwegian (Nynorsk)',
        sv_SE: 'Swedish',
        da_DK: 'Danish',
        fi: 'Finnish',
        de_DE: 'German',
        de_AT: 'German',
        de_CH: 'German',
        fr_FR: 'French',
        fr_CA: 'French',
        es_ES: 'Spanish',
        es_MX: 'Spanish',
        it_IT: 'Italian',
        pt_PT: 'Portuguese',
        pt_BR: 'Portuguese',
        nl_NL: 'Dutch',
        pl_PL: 'Polish',
        ru_RU: 'Russian',
        ja: 'Japanese',
        ko_KR: 'Korean',
        zh_CN: 'Chinese (Simplified)',
        zh_TW: 'Chinese (Traditional)',
        ar: 'Arabic',
        he_IL: 'Hebrew',
      }

      // Try exact match first
      if (languageMap[locale]) {
        return languageMap[locale]
      }

      // Try language code only (e.g., 'en' from 'en_US')
      const langCode = locale.split('_')[0]
      for (const [key, value] of Object.entries(languageMap)) {
        if (key.startsWith(langCode)) {
          return value
        }
      }

      // Fallback to English
      return 'English'
    },

    async *scanMedia({ missingAltOnly = false, limit = undefined, perPage = 100 }) {
      let page = 1
      let fetched = 0

      while (true) {
        const { data, headers } = await request(
          `/wp/v2/media?per_page=${perPage}&page=${page}&media_type=image`
        )

        for (const item of data) {
          if (missingAltOnly && item.alt_text) {
            continue
          }

          const thumbnailUrl =
            item.media_details?.sizes?.thumbnail?.source_url ||
            item.media_details?.sizes?.medium?.source_url

          yield {
            id: item.id,
            sourceUrl: item.source_url,
            thumbnailUrl,
            filename: item.slug,
            title: item.title?.rendered || '',
            currentAlt: item.alt_text || '',
            mimeType: item.mime_type,
          }

          fetched++
          if (limit && fetched >= limit) {
            return
          }
        }

        const totalPages = parseInt(headers.get('X-WP-TotalPages') || '1')
        if (data.length < perPage || page >= totalPages) {
          break
        }

        page++
      }
    },

    async updateAltText(mediaId, altText) {
      const { data } = await request(`/wp/v2/media/${mediaId}`, {
        method: 'POST',
        body: JSON.stringify({ alt_text: altText }),
      })

      return {
        id: data.id,
        altText: data.alt_text,
      }
    },

    async getMedia(mediaId) {
      const { data } = await request(`/wp/v2/media/${mediaId}`)
      return data
    },

    async getUncategorizedMedia(limit = 50) {
      // Query media not assigned to any vmfo_folder taxonomy term
      // VMF stores folder assignments as terms in the vmfo_folder taxonomy
      // Media without any vmfo_folder terms are uncategorized
      const results = []
      let page = 1
      const perPage = Math.min(limit, 100)

      while (results.length < limit) {
        // Fetch media and include vmfo_folder terms in response
        // The _embed parameter or explicitly requesting terms via taxonomy is needed
        const { data, headers } = await request(
          `/wp/v2/media?per_page=${perPage}&page=${page}&media_type=image&vmfo_folder=0`
        )
        
        // If the vmfo_folder=0 filter works (VMF supports it), all returned items are uncategorized
        // If it doesn't work, fall back to checking each item
        const vmfoFilterSupported = data.length === 0 || data.every(item => {
          const folderTerms = item.vmfo_folder || []
          return folderTerms.length === 0
        })

        for (const item of data) {
          // Check if media has no vmfo_folder terms (fallback check)
          const folderTerms = item.vmfo_folder || []
          
          // If vmfo_folder field is missing from response, we can't determine categorization
          // In that case, skip this item (it means VMF doesn't expose the field)
          if (!vmfoFilterSupported && !('vmfo_folder' in item)) {
            console.warn('[WP] vmfo_folder field not in response, cannot determine uncategorized status for item', item.id)
            continue
          }
          
          if (vmfoFilterSupported || folderTerms.length === 0) {
            const thumbnailUrl =
              item.media_details?.sizes?.thumbnail?.source_url ||
              item.media_details?.sizes?.medium?.source_url

            results.push({
              id: item.id,
              sourceUrl: item.source_url,
              thumbnailUrl,
              filename: item.slug,
              title: item.title?.rendered || '',
              currentAlt: item.alt_text || '',
              caption: item.caption?.rendered || '',
              mimeType: item.mime_type,
            })

            if (results.length >= limit) break
          }
        }

        const totalPages = parseInt(headers.get('X-WP-TotalPages') || '1')
        if (data.length < perPage || page >= totalPages) {
          break
        }

        page++
      }

      return results
    },

    /**
     * Install and activate a plugin from WordPress.org
     * @param {string} slug - The plugin slug from wordpress.org
     * @returns {Promise<{plugin: string, status: string, name: string}>}
     */
    async installPlugin(slug) {
      const { data } = await request('/wp/v2/plugins', {
        method: 'POST',
        body: JSON.stringify({
          slug,
          status: 'active',
        }),
      })
      return {
        plugin: data.plugin,
        status: data.status,
        name: data.name,
      }
    },

    /**
     * List all installed plugins
     * @returns {Promise<Array<{plugin: string, status: string, name: string}>>}
     */
    async listPlugins() {
      const { data } = await request('/wp/v2/plugins')
      return data.map(p => ({
        plugin: p.plugin,
        status: p.status,
        name: p.name,
      }))
    },

    /**
     * Find a plugin by slug (searches in the plugin identifier)
     * @param {string} slug - The plugin slug to search for
     * @returns {Promise<{plugin: string, status: string, name: string}|null>}
     */
    async findPluginBySlug(slug) {
      const plugins = await this.listPlugins()
      // Plugin identifiers are like "plugin-folder/plugin-file.php"
      // The folder usually matches the slug
      return plugins.find(p => p.plugin.startsWith(`${slug}/`)) || null
    },

    /**
     * Activate an already installed plugin
     * @param {string} plugin - The plugin identifier (e.g., 'virtual-media-folders/virtual-media-folders.php')
     * @returns {Promise<{status: string}>}
     */
    async activatePlugin(plugin) {
      const { data } = await request(`/wp/v2/plugins/${encodeURIComponent(plugin)}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'active',
        }),
      })
      return {
        status: data.status,
      }
    },

    /**
     * Get plugin status
     * @param {string} plugin - The plugin identifier
     * @returns {Promise<{status: string, name: string}|null>}
     */
    async getPluginStatus(plugin) {
      try {
        const { data } = await request(`/wp/v2/plugins/${encodeURIComponent(plugin)}`)
        return {
          status: data.status,
          name: data.name,
        }
      } catch {
        return null
      }
    },
  }
}
