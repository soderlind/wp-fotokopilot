import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { wpHandlers, vmfHandlers } from '../mocks/wp-server.js'
import { createWpClient } from '../../src/main/services/wp-client.js'
import { JobQueue } from '../../src/main/services/job-queue.js'

vi.mock('../../src/main/services/copilot-adapter.js', () => ({
  initCopilot: vi.fn(),
  stopCopilot: vi.fn(),
  generateAltText: vi.fn().mockResolvedValue({
    altText: 'Generated alt text for test image',
    valid: true,
    issues: [],
  }),
}))

const server = setupServer(...wpHandlers, ...vmfHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Scan and Generate Workflow', () => {
  const credentials = {
    url: 'https://test.local',
    username: 'admin',
    password: 'test-password',
  }

  it('scans media, generates alt text, and applies updates', async () => {
    const wpClient = createWpClient(credentials)
    const jobQueue = new JobQueue({ concurrency: 2, maxRetries: 2 })

    const scannedItems = []
    for await (const item of wpClient.scanMedia({ missingAltOnly: true, limit: 5 })) {
      scannedItems.push(item)
    }

    expect(scannedItems.length).toBeGreaterThan(0)

    const { generateAltText } = await import('../../src/main/services/copilot-adapter.js')

    const generateHandler = async (item) => {
      const result = await generateAltText('/fake/path.jpg')
      return { altText: result.altText, valid: result.valid }
    }

    jobQueue.createJob('generate', scannedItems, generateHandler)
    const generateResult = await jobQueue.start('generate')

    expect(generateResult.status).toBe('completed')
    expect(generateResult.completed).toBe(scannedItems.length)

    const itemsWithAlt = generateResult.items.map((item) => ({
      ...item,
      proposedAlt: item.result?.altText || 'Generated alt text for test image',
    }))

    const applyHandler = async (item) => {
      return wpClient.updateAltText(item.id, item.proposedAlt)
    }

    jobQueue.createJob('apply', itemsWithAlt, applyHandler)
    const applyResult = await jobQueue.start('apply')

    expect(applyResult.status).toBe('completed')
    expect(applyResult.completed).toBe(itemsWithAlt.length)
  })

  it('handles partial failures gracefully', async () => {
    const wpClient = createWpClient(credentials)
    const jobQueue = new JobQueue({ concurrency: 2, maxRetries: 1 })

    const items = [
      { id: 1, proposedAlt: 'Alt for image 1' },
      { id: 2, proposedAlt: 'Alt for image 2' },
      { id: 3, proposedAlt: 'Alt for image 3' },
    ]

    let callCount = 0
    const handler = async (item) => {
      callCount++
      if (item.id === 2) {
        throw new Error('Simulated failure for item 2')
      }
      return wpClient.updateAltText(item.id, item.proposedAlt)
    }

    jobQueue.createJob('apply-partial', items, handler)
    const result = await jobQueue.start('apply-partial')

    expect(result.status).toBe('completed_with_errors')
    expect(result.completed).toBe(2)
    expect(result.failed).toBe(1)

    const failedItem = result.items.find((i) => i.id === 2)
    expect(failedItem.status).toBe('failed')
    expect(failedItem.error).toContain('Simulated failure')
  })

  it('exports results in CSV format', async () => {
    const jobQueue = new JobQueue()
    const items = [
      { id: 1, filename: 'image1.jpg', currentAlt: '', proposedAlt: 'New alt 1' },
      { id: 2, filename: 'image2.jpg', currentAlt: 'Old alt', proposedAlt: 'New alt 2' },
    ]

    jobQueue.createJob('export-test', items, async () => ({ applied: true }))
    await jobQueue.start('export-test')

    const job = jobQueue.getJob('export-test')
    const changes = job.items.map((i) => ({
      id: i.id,
      filename: i.filename,
      oldAlt: i.currentAlt,
      newAlt: i.proposedAlt,
      status: i.status,
    }))

    const csv = [
      'id,filename,old_alt,new_alt,status',
      ...changes.map(
        (c) => `${c.id},${c.filename},${c.oldAlt},${c.newAlt},${c.status}`
      ),
    ].join('\n')

    expect(csv).toContain('id,filename,old_alt,new_alt,status')
    expect(csv).toContain('image1.jpg')
    expect(csv).toContain('completed')
  })
})
