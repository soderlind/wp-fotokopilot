import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JobQueue } from '../../src/main/services/job-queue.js'

describe('JobQueue', () => {
  let queue

  beforeEach(() => {
    queue = new JobQueue({ concurrency: 2, maxRetries: 3 })
  })

  describe('createJob', () => {
    it('creates a job with correct initial state', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const job = queue.createJob('test-job', items, async () => ({}))

      expect(job.id).toBe('test-job')
      expect(job.status).toBe('pending')
      expect(job.total).toBe(3)
      expect(job.completed).toBe(0)
      expect(job.failed).toBe(0)
      expect(job.items.length).toBe(3)
      expect(job.items[0].status).toBe('pending')
    })
  })

  describe('start', () => {
    it('processes all items', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const handler = vi.fn().mockResolvedValue({ success: true })

      queue.createJob('test-job', items, handler)
      const result = await queue.start('test-job')

      expect(handler).toHaveBeenCalledTimes(3)
      expect(result.status).toBe('completed')
      expect(result.completed).toBe(3)
      expect(result.failed).toBe(0)
    })

    it('respects concurrency limit', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
      let concurrent = 0
      let maxConcurrent = 0

      const handler = vi.fn(async () => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise((r) => setTimeout(r, 50))
        concurrent--
        return { success: true }
      })

      queue.createJob('test-job', items, handler)
      await queue.start('test-job')

      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it('retries failed items with exponential backoff', { timeout: 15000 }, async () => {
      const items = [{ id: 1 }]
      let attempts = 0

      const handler = vi.fn(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return { success: true }
      })

      queue.createJob('test-job', items, handler)
      const result = await queue.start('test-job')

      expect(attempts).toBe(3)
      expect(result.completed).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('marks item as failed after max retries', { timeout: 15000 }, async () => {
      const items = [{ id: 1 }]
      const handler = vi.fn().mockRejectedValue(new Error('Permanent failure'))

      queue.createJob('test-job', items, handler)
      const result = await queue.start('test-job')

      expect(handler).toHaveBeenCalledTimes(3)
      expect(result.status).toBe('completed_with_errors')
      expect(result.failed).toBe(1)
      expect(result.items[0].status).toBe('failed')
      expect(result.items[0].error).toBe('Permanent failure')
    })

    it('emits progress events', async () => {
      const items = [{ id: 1 }, { id: 2 }]
      const handler = vi.fn().mockResolvedValue({ success: true })
      const progressEvents = []

      queue.on('job:progress', (data) => progressEvents.push(data))
      queue.createJob('test-job', items, handler)
      await queue.start('test-job')

      expect(progressEvents.length).toBeGreaterThan(0)
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.completed).toBe(2)
    })
  })

  describe('pause and resume', () => {
    it('pauses and resumes job', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
      let processed = 0

      const handler = vi.fn(async () => {
        processed++
        await new Promise((r) => setTimeout(r, 50))
        return { success: true }
      })

      queue.createJob('test-job', items, handler)
      const jobPromise = queue.start('test-job')

      await new Promise((r) => setTimeout(r, 60))
      queue.pause('test-job')

      const job = queue.getJob('test-job')
      expect(job.paused).toBe(true)

      queue.resume('test-job')
      await jobPromise

      expect(processed).toBe(4)
    })
  })

  describe('cancel', () => {
    it('cancels running job', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
      let processed = 0

      const handler = vi.fn(async () => {
        processed++
        await new Promise((r) => setTimeout(r, 100))
        return { success: true }
      })

      queue.createJob('test-job', items, handler)
      const jobPromise = queue.start('test-job')

      await new Promise((r) => setTimeout(r, 50))
      queue.cancel('test-job')

      const result = await jobPromise
      expect(result.status).toBe('cancelled')
      expect(processed).toBeLessThan(4)
    })
  })

  describe('getStats', () => {
    it('returns queue statistics', () => {
      queue.createJob('job-1', [{ id: 1 }], async () => ({}))
      queue.createJob('job-2', [{ id: 2 }], async () => ({}))

      const stats = queue.getStats()
      expect(stats.total).toBe(2)
      expect(stats.pending).toBe(2)
    })
  })
})
