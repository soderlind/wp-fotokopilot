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
      const error = new Error(`WordPress API error: ${response.status}`)
      error.code = 'WP_ERROR'
      error.status = response.status
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
  }
}
