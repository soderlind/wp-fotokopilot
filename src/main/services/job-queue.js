/**
 * @fileoverview Concurrent job queue with retry logic and progress tracking.
 * Handles batch processing of media items for alt text generation and folder organization.
 * @module main/services/job-queue
 */

import { EventEmitter } from 'node:events'

/**
 * @typedef {Object} JobItem
 * @property {number} id - Media item ID
 * @property {string} status - 'pending' | 'processing' | 'completed' | 'failed' | 'retry'
 * @property {number} attempts - Number of processing attempts
 * @property {string} [error] - Error message if failed
 * @property {Object} [result] - Handler result data
 * @property {string} [proposedAlt] - Generated alt text
 */

/**
 * @typedef {Object} Job
 * @property {string} id - Unique job identifier
 * @property {string} status - 'pending' | 'running' | 'paused' | 'completed' | 'cancelled'
 * @property {number} total - Total items in job
 * @property {number} completed - Successfully completed items
 * @property {number} failed - Failed items
 * @property {number} [startedAt] - Job start timestamp
 * @property {number} [finishedAt] - Job completion timestamp
 * @property {JobItem[]} items - All job items
 * @property {Function} handler - Async handler function for processing items
 * @property {boolean} paused - Whether job is paused
 * @property {boolean} cancelled - Whether job is cancelled
 */

/**
 * Concurrent job queue with automatic retries and progress events.
 * @extends EventEmitter
 * @fires JobQueue#job:started
 * @fires JobQueue#job:progress
 * @fires JobQueue#job:finished
 */
export class JobQueue extends EventEmitter {
  /**
   * Creates a new job queue.
   * @param {Object} options - Queue configuration
   * @param {number} [options.concurrency=3] - Maximum concurrent workers
   * @param {number} [options.maxRetries=3] - Maximum retry attempts per item
   */
  constructor({ concurrency = 3, maxRetries = 3 } = {}) {
    super()
    /** @type {number} */
    this.concurrency = concurrency
    /** @type {number} */
    this.maxRetries = maxRetries
    /** @type {Map<string, Job>} */
    this.jobs = new Map()
  }

  /**
   * Creates a new job without starting it.
   * @param {string} id - Unique job identifier
   * @param {Array<{id: number}>} items - Items to process
   * @param {Function} handler - Async handler for each item
   * @returns {Job} Created job
   */
  createJob(id, items, handler) {
    const job = {
      id,
      status: 'pending',
      total: items.length,
      completed: 0,
      failed: 0,
      startedAt: undefined,
      finishedAt: undefined,
      items: items.map((item) => ({
        ...item,
        status: 'pending',
        attempts: 0,
        error: undefined,
        result: undefined,
      })),
      handler,
      paused: false,
      cancelled: false,
    }

    this.jobs.set(id, job)
    return job
  }

  /**
   * Starts processing a job.
   * @param {string} jobId - Job identifier
   * @returns {Promise<Job>} Completed job
   * @throws {Error} If job not found
   */
  async start(jobId) {
    const job = this.jobs.get(jobId)
    if (!job) {
      throw new Error(`Job not found: ${jobId}`)
    }

    job.status = 'running'
    job.startedAt = Date.now()
    this.emit('job:started', { jobId })
    this.emitProgress(job)

    const pending = job.items.filter(
      (i) => i.status === 'pending' || i.status === 'retry'
    )
    const executing = new Set()

    for (const item of pending) {
      if (job.cancelled) break

      while (job.paused) {
        await sleep(100)
        if (job.cancelled) break
      }

      if (job.cancelled) break

      const promise = this.processItem(job, item).finally(() => {
        executing.delete(promise)
      })

      executing.add(promise)

      if (executing.size >= this.concurrency) {
        await Promise.race(executing)
      }
    }

    await Promise.all(executing)

    job.finishedAt = Date.now()

    if (job.cancelled) {
      job.status = 'cancelled'
    } else if (job.failed > 0) {
      job.status = 'completed_with_errors'
    } else {
      job.status = 'completed'
    }

    this.emit('job:finished', {
      jobId,
      status: job.status,
      completed: job.completed,
      failed: job.failed,
      duration: job.finishedAt - job.startedAt,
    })

    this.emitProgress(job)
    return job
  }

  /**
   * Processes a single item with retry logic.
   * @private
   * @param {Job} job - Parent job
   * @param {JobItem} item - Item to process
   * @returns {Promise<void>}
   */
  async processItem(job, item) {
    item.status = 'processing'
    item.attempts++
    this.emitProgress(job)

    try {
      const result = await job.handler(item)
      item.status = 'completed'
      item.result = result
      job.completed++

      if (result?.altText !== undefined) {
        item.proposedAlt = result.altText
      }
    } catch (error) {
      if (item.attempts < this.maxRetries) {
        item.status = 'retry'
        const delay = Math.pow(2, item.attempts) * 1000
        await sleep(delay)

        if (!job.cancelled) {
          return this.processItem(job, item)
        }
      }

      item.status = 'failed'
      item.error = error.message || String(error)
      job.failed++
    }

    this.emitProgress(job)
  }

  /**
   * Emits a progress event for the job.
   * @private
   * @param {Job} job - Job to report progress for
   */
  emitProgress(job) {
    const progress = {
      jobId: job.id,
      status: job.status,
      total: job.total,
      completed: job.completed,
      failed: job.failed,
      paused: job.paused,
      items: job.items.map((i) => ({
        id: i.id,
        status: i.status,
        proposedAlt: i.proposedAlt || i.result?.altText,
        result: i.result, // Include full result for folder suggestions etc.
        error: i.error,
      })),
    }

    this.emit('job:progress', progress)
  }

  /**
   * Pauses a running job.
   * @param {string} jobId - Job identifier
   */
  pause(jobId) {
    const job = this.jobs.get(jobId)
    if (job && job.status === 'running') {
      job.paused = true
      job.status = 'paused'
      this.emitProgress(job)
    }
  }

  /**
   * Resumes a paused job.
   * @param {string} jobId - Job identifier
   */
  resume(jobId) {
    const job = this.jobs.get(jobId)
    if (job && job.paused) {
      job.paused = false
      job.status = 'running'
      this.emitProgress(job)
    }
  }

  /**
   * Cancels a job.
   * @param {string} jobId - Job identifier
   */
  cancel(jobId) {
    const job = this.jobs.get(jobId)
    if (job) {
      job.cancelled = true
      job.paused = false
    }
  }

  /**
   * Gets a job by ID.
   * @param {string} jobId - Job identifier
   * @returns {Job|undefined}
   */
  getJob(jobId) {
    return this.jobs.get(jobId)
  }

  /**
   * Removes a job from the queue.
   * @param {string} jobId - Job identifier
   */
  clearJob(jobId) {
    this.jobs.delete(jobId)
  }

  /**
   * Gets queue statistics.
   * @returns {{running: number, pending: number, completed: number, total: number}}
   */
  getStats() {
    let running = 0
    let pending = 0
    let completed = 0

    for (const job of this.jobs.values()) {
      if (job.status === 'running' || job.status === 'paused') running++
      else if (job.status === 'pending') pending++
      else completed++
    }

    return { running, pending, completed, total: this.jobs.size }
  }
}

/**
 * Sleeps for specified milliseconds.
 * @private
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
