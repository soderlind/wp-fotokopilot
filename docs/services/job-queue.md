# job-queue

Concurrent job queue with retry logic and progress tracking for batch processing.

**Module:** `main/services/job-queue`  
**Source:** [src/main/services/job-queue.js](../src/main/services/job-queue.js)

## Overview

The `JobQueue` class provides:

- Configurable concurrency (parallel workers)
- Automatic retry with exponential backoff
- Pause/resume/cancel support
- Progress events via EventEmitter

---

## Type Definitions

### JobItem

Individual item within a job.

```typescript
interface JobItem {
  /** Media item ID */
  id: number
  /** Processing status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retry'
  /** Number of processing attempts */
  attempts: number
  /** Error message if failed */
  error?: string
  /** Handler result data */
  result?: object
  /** Generated alt text (for alt-text jobs) */
  proposedAlt?: string
}
```

### Job

Job container with items and state.

```typescript
interface Job {
  /** Unique job identifier */
  id: string
  /** Job status */
  status: 'pending' | 'running' | 'paused' | 'completed' | 'completed_with_errors' | 'cancelled'
  /** Total items in job */
  total: number
  /** Successfully completed items */
  completed: number
  /** Failed items (after max retries) */
  failed: number
  /** Job start timestamp (ms) */
  startedAt?: number
  /** Job completion timestamp (ms) */
  finishedAt?: number
  /** All job items */
  items: JobItem[]
  /** Whether job is paused */
  paused: boolean
  /** Whether job is cancelled */
  cancelled: boolean
}
```

### JobProgress

Progress event payload.

```typescript
interface JobProgress {
  jobId: string
  status: string
  total: number
  completed: number
  failed: number
  paused: boolean
  items: Array<{
    id: number
    status: string
    proposedAlt?: string
    result?: object
    error?: string
  }>
}
```

---

## Class: JobQueue

### Constructor

```javascript
import { JobQueue } from './services/job-queue.js'

const queue = new JobQueue({
  concurrency: 3,  // Max parallel workers
  maxRetries: 3    // Retry attempts per item
})
```

**Options:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `concurrency` | `number` | `3` | Maximum concurrent workers |
| `maxRetries` | `number` | `3` | Maximum retry attempts per item |

---

## Methods

### createJob(id, items, handler)

Creates a new job without starting it.

```javascript
const job = queue.createJob('alt-text-123', mediaItems, async (item) => {
  const result = await generateAltText(item.thumbnailPath)
  return { altText: result.altText }
})
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique job identifier |
| `items` | `Array<{id: number}>` | Items to process |
| `handler` | `(item: JobItem) => Promise<object>` | Async handler for each item |

**Returns:** `Job` — Created job (not yet started)

---

### start(jobId)

Starts processing a job.

```javascript
const completedJob = await queue.start('alt-text-123')

console.log(`Completed: ${completedJob.completed}`)
console.log(`Failed: ${completedJob.failed}`)
console.log(`Duration: ${completedJob.finishedAt - completedJob.startedAt}ms`)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `jobId` | `string` | Job identifier |

**Returns:** `Promise<Job>` — Completed job

**Throws:** `Error` if job not found

**Behavior:**

1. Sets status to `'running'`
2. Processes items with configured concurrency
3. Retries failed items with exponential backoff
4. Waits for all items to complete
5. Sets final status based on results

---

### pause(jobId)

Pauses a running job.

```javascript
queue.pause('alt-text-123')
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `jobId` | `string` | Job identifier |

**Behavior:**
- Sets `paused: true` and `status: 'paused'`
- Active items continue until current operation completes
- New items won't start until resumed

---

### resume(jobId)

Resumes a paused job.

```javascript
queue.resume('alt-text-123')
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `jobId` | `string` | Job identifier |

---

### cancel(jobId)

Cancels a job.

```javascript
queue.cancel('alt-text-123')
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `jobId` | `string` | Job identifier |

**Behavior:**
- Sets `cancelled: true`
- Active items may complete
- Pending items won't start
- Final status will be `'cancelled'`

---

### getJob(jobId)

Gets a job by ID.

```javascript
const job = queue.getJob('alt-text-123')
if (job) {
  console.log(job.status, job.completed, job.total)
}
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `jobId` | `string` | Job identifier |

**Returns:** `Job | undefined`

---

### clearJob(jobId)

Removes a job from the queue.

```javascript
queue.clearJob('alt-text-123')
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `jobId` | `string` | Job identifier |

---

### getStats()

Gets queue statistics.

```javascript
const stats = queue.getStats()
console.log(`Running: ${stats.running}, Pending: ${stats.pending}, Total: ${stats.total}`)
```

**Returns:**

```typescript
{
  running: number    // Jobs currently running or paused
  pending: number    // Jobs not yet started
  completed: number  // Finished jobs
  total: number      // Total jobs in queue
}
```

---

## Events

The JobQueue extends EventEmitter and emits progress events.

### job:started

Emitted when a job starts processing.

```javascript
queue.on('job:started', ({ jobId }) => {
  console.log(`Job ${jobId} started`)
})
```

### job:progress

Emitted after each item completes or fails.

```javascript
queue.on('job:progress', (progress) => {
  console.log(`${progress.completed}/${progress.total} complete`)
  
  // Send to renderer
  mainWindow.webContents.send('job:progress', progress)
})
```

**Payload:** `JobProgress`

### job:finished

Emitted when a job completes (success, error, or cancelled).

```javascript
queue.on('job:finished', ({ jobId, status, completed, failed, duration }) => {
  console.log(`Job ${jobId} ${status}`)
  console.log(`${completed} succeeded, ${failed} failed in ${duration}ms`)
})
```

---

## Retry Logic

Failed items are automatically retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | 2 seconds |
| 2 | 4 seconds |
| 3 | 8 seconds |

After `maxRetries` attempts, the item is marked as `'failed'`.

---

## Usage Example

### Alt Text Generation Job

```javascript
import { JobQueue } from './services/job-queue.js'
import { generateAltText } from './services/copilot-adapter.js'
import { getThumbnailPath } from './services/thumbnail-cache.js'

const queue = new JobQueue({ concurrency: 3 })

// Handle progress events
queue.on('job:progress', (progress) => {
  mainWindow.webContents.send('job:progress', progress)
})

// Create and start job
const job = queue.createJob('alt-text-batch', mediaItems, async (item) => {
  // Download thumbnail to cache
  const thumbnailPath = await getThumbnailPath(item)
  
  // Generate alt text
  const result = await generateAltText(thumbnailPath, { maxLength: 125 })
  
  return { altText: result.altText }
})

await queue.start('alt-text-batch')
```

### Folder Organization Job

```javascript
const job = queue.createJob('folder-batch', mediaItems, async (item) => {
  const thumbnailPath = await getThumbnailPath(item)
  
  const result = await generateAltTextWithFolder(thumbnailPath, folders, {
    languageName: 'English',
    metadata: { filename: item.filename }
  })
  
  return {
    action: result.action,
    folderId: result.folderId,
    folderPath: result.folderPath,
    newFolderPath: result.newFolderPath,
    confidence: result.confidence
  }
})
```

---

## Concurrency Diagram

```
Queue (concurrency = 3)
├── Worker 1 ── Item 1 ✓ ── Item 4 ✓ ── Item 7 ...
├── Worker 2 ── Item 2 ✗ (retry) ── Item 2 ✓ ── Item 8 ...
└── Worker 3 ── Item 3 ✓ ── Item 5 ✓ ── Item 6 ✓ ...
```

Items are distributed to available workers. When a worker finishes an item, it picks up the next pending item.
