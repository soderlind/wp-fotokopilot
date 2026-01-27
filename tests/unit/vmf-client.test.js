import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { vmfHandlers } from '../mocks/wp-server.js'
import { createVmfClient } from '../../src/main/services/vmf-client.js'

const server = setupServer(...vmfHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('VmfClient', () => {
  const credentials = {
    url: 'https://test.local',
    username: 'admin',
    password: 'test-password',
  }

  describe('listFolders', () => {
    it('returns folder tree structure', async () => {
      const client = createVmfClient(credentials)
      const folders = await client.listFolders()

      expect(folders.length).toBe(2)
      expect(folders[0].name).toBe('Products')
      expect(folders[0].children.length).toBe(2)
    })

    it('computes folder paths correctly', async () => {
      const client = createVmfClient(credentials)
      const folders = await client.listFolders()

      const electronics = folders[0].children.find((f) => f.name === 'Electronics')
      expect(electronics.path).toBe('Products/Electronics')
    })
  })

  describe('createFolder', () => {
    it('creates a new folder', async () => {
      const client = createVmfClient(credentials)
      const folder = await client.createFolder('New Folder', 0)

      expect(folder.name).toBe('New Folder')
      expect(folder.id).toBeDefined()
    })
  })

  describe('createFolderPath', () => {
    it('creates nested folder structure', async () => {
      const client = createVmfClient(credentials)
      const folder = await client.createFolderPath('Products/New/Nested')

      expect(folder.name).toBe('Nested')
    })

    it('reuses existing folders in path', async () => {
      const client = createVmfClient(credentials)
      const folder = await client.createFolderPath('Products/Electronics')

      expect(folder.name).toBe('Electronics')
    })
  })

  describe('assignMedia', () => {
    it('assigns media to folder', async () => {
      const client = createVmfClient(credentials)
      const results = await client.assignMedia(1, [10, 11, 12])

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(3)
    })

    it('handles single media ID', async () => {
      const client = createVmfClient(credentials)
      const results = await client.assignMedia(1, 10)

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(1)
    })
  })
})
