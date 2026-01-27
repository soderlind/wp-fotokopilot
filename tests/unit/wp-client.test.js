import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { wpHandlers, vmfHandlers, errorHandlers } from '../mocks/wp-server.js'
import { createWpClient } from '../../src/main/services/wp-client.js'

const server = setupServer(...wpHandlers, ...vmfHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('WpClient', () => {
  const credentials = {
    url: 'https://test.local',
    username: 'admin',
    password: 'test-password',
  }

  describe('testConnection', () => {
    it('returns site info on successful connection', async () => {
      const client = createWpClient(credentials)
      const result = await client.testConnection()

      expect(result.name).toBe('Test WordPress Site')
      expect(result.url).toBe('https://test.local')
      expect(result.capabilities.rest).toBe(true)
    })

    it('detects VMF availability', async () => {
      const client = createWpClient(credentials)
      const result = await client.testConnection()

      expect(result.capabilities.vmf).toBe(true)
    })

    it('returns site locale', async () => {
      const client = createWpClient(credentials)
      const result = await client.testConnection()

      expect(result.locale).toBeDefined()
    })
  })

  describe('getSiteLocale', () => {
    it('fetches site locale', async () => {
      const client = createWpClient(credentials)
      const locale = await client.getSiteLocale()

      expect(locale).toBeDefined()
      expect(typeof locale).toBe('string')
    })
  })

  describe('getLanguageName', () => {
    it('maps common locales to language names', () => {
      const client = createWpClient(credentials)

      expect(client.getLanguageName('en_US')).toBe('English')
      expect(client.getLanguageName('nb_NO')).toBe('Norwegian (Bokmål)')
      expect(client.getLanguageName('nn_NO')).toBe('Norwegian (Nynorsk)')
      expect(client.getLanguageName('sv_SE')).toBe('Swedish')
      expect(client.getLanguageName('de_DE')).toBe('German')
      expect(client.getLanguageName('fr_FR')).toBe('French')
    })

    it('falls back to language code prefix', () => {
      const client = createWpClient(credentials)

      expect(client.getLanguageName('en_NZ')).toBe('English')
      expect(client.getLanguageName('de_LI')).toBe('German')
    })

    it('defaults to English for unknown locales', () => {
      const client = createWpClient(credentials)

      expect(client.getLanguageName('unknown_XX')).toBe('English')
    })
  })

  describe('scanMedia', () => {
    it('fetches media items', async () => {
      const client = createWpClient(credentials)
      const items = []

      for await (const item of client.scanMedia({ perPage: 10 })) {
        items.push(item)
        if (items.length >= 5) break
      }

      expect(items.length).toBe(5)
      expect(items[0]).toHaveProperty('id')
      expect(items[0]).toHaveProperty('sourceUrl')
      expect(items[0]).toHaveProperty('thumbnailUrl')
    })

    it('respects limit option', async () => {
      const client = createWpClient(credentials)
      const items = []

      for await (const item of client.scanMedia({ limit: 3 })) {
        items.push(item)
      }

      expect(items.length).toBe(3)
    })

    it('filters missing alt text only', async () => {
      const client = createWpClient(credentials)
      const items = []

      for await (const item of client.scanMedia({ missingAltOnly: true, limit: 10 })) {
        items.push(item)
      }

      for (const item of items) {
        expect(item.currentAlt).toBe('')
      }
    })

    it('paginates correctly', async () => {
      const client = createWpClient(credentials)
      const items = []

      for await (const item of client.scanMedia({ perPage: 5 })) {
        items.push(item)
      }

      expect(items.length).toBe(25)
      const ids = items.map((i) => i.id)
      expect(new Set(ids).size).toBe(25)
    })
  })

  describe('updateAltText', () => {
    it('updates alt text for media item', async () => {
      const client = createWpClient(credentials)
      const result = await client.updateAltText(1, 'New alt text')

      expect(result.id).toBe(1)
      expect(result.altText).toBe('New alt text')
    })
  })

  describe('error handling', () => {
    it('handles 401 unauthorized', async () => {
      server.use(errorHandlers.unauthorized)
      const client = createWpClient(credentials)

      await expect(client.testConnection()).rejects.toThrow('Unauthorized')
    })

    it('handles 429 rate limiting', async () => {
      server.use(errorHandlers.rateLimited)
      const client = createWpClient(credentials)

      try {
        const items = []
        for await (const item of client.scanMedia({})) {
          items.push(item)
        }
      } catch (error) {
        expect(error.code).toBe('RATE_LIMITED')
        expect(error.retryAfter).toBe(60)
      }
    })
  })
})
