import { EventEmitter } from 'node:events'

export class JobQueue extends EventEmitter {
  constructor({ concurrency = 3, maxRetries = 3 } = {}) {
    super()
    this.concurrency = concurrency
    this.maxRetries = maxRetries
    this.jobs = new Map()
  }

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

  pause(jobId) {
    const job = this.jobs.get(jobId)
    if (job && job.status === 'running') {
      job.paused = true
      job.status = 'paused'
      this.emitProgress(job)
    }
  }

  resume(jobId) {
    const job = this.jobs.get(jobId)
    if (job && job.paused) {
      job.paused = false
      job.status = 'running'
      this.emitProgress(job)
    }
  }

  cancel(jobId) {
    const job = this.jobs.get(jobId)
    if (job) {
      job.cancelled = true
      job.paused = false
    }
  }

  getJob(jobId) {
    return this.jobs.get(jobId)
  }

  clearJob(jobId) {
    this.jobs.delete(jobId)
  }

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
