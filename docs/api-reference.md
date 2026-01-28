# API Reference

This document provides an overview of all services and utilities. Click the links for detailed documentation with JSDoc-based type definitions, parameters, and examples.

## Services

### WordPress & Media

| Service | Description | Documentation |
|---------|-------------|---------------|
| **wp-client** | WordPress REST API client for media management | [View →](services/wp-client.md) |
| **vmf-client** | Virtual Media Folders API for folder organization | [View →](services/vmf-client.md) |

### AI & Processing

| Service | Description | Documentation |
|---------|-------------|---------------|
| **copilot-adapter** | GitHub Copilot SDK for alt text & folder suggestions | [View →](services/copilot-adapter.md) |
| **job-queue** | Concurrent job processing with retry logic | [View →](services/job-queue.md) |
| **thumbnail-cache** | Local image cache with LRU eviction | [View →](services/thumbnail-cache.md) |

### Storage & Configuration

| Service | Description | Documentation |
|---------|-------------|---------------|
| **credential-store** | Secure credential storage using OS keychain | [View →](services/credential-store.md) |
| **settings-store** | Application settings persistence | [View →](services/settings-store.md) |

### Utilities

| Utility | Description | Documentation |
|---------|-------------|---------------|
| **validation** | Alt text validation and sanitization | [View →](services/validation.md) |

---

## Quick Reference

### wp-client

WordPress REST API client for media management.

```javascript
import { createWpClient } from './services/wp-client.js'

const client = createWpClient({
  url: 'https://example.com',
  username: 'admin',
  password: 'xxxx xxxx xxxx xxxx'
})
```

| Method | Returns | Description |
|--------|---------|-------------|
| `testConnection()` | `Promise<SiteInfo>` | Tests connection and returns site info |
| `getSiteLocale()` | `Promise<string>` | Gets site language locale |
| `scanMedia(options)` | `AsyncGenerator<MediaItem>` | Scans media library |
| `updateAltText(mediaId, altText)` | `Promise<{id, altText}>` | Updates alt text |
| `getUncategorizedMedia(limit)` | `Promise<MediaItem[]>` | Gets media without folders |
| `listPlugins()` | `Promise<Plugin[]>` | Lists installed plugins |
| `installPlugin(slug)` | `Promise<Plugin>` | Installs plugin from WP.org |

[Full documentation →](services/wp-client.md)

---

### vmf-client

Virtual Media Folders REST API client.

```javascript
import { createVmfClient } from './services/vmf-client.js'

const vmf = createVmfClient({
  url: 'https://example.com',
  username: 'admin',
  password: 'xxxx xxxx xxxx xxxx'
})
```

| Method | Returns | Description |
|--------|---------|-------------|
| `listFolders()` | `Promise<VmfFolder[]>` | Lists folders as tree |
| `createFolder(name, parentId)` | `Promise<VmfFolder>` | Creates a folder |
| `createFolderPath(path)` | `Promise<VmfFolder>` | Creates nested path |
| `assignMedia(folderId, mediaIds)` | `Promise<Array>` | Assigns media to folder |
| `removeMedia(folderId, mediaIds)` | `Promise<Array>` | Removes media from folder |
| `getUncategorizedMedia(limit)` | `Promise<MediaItem[]>` | Gets unassigned media |

[Full documentation →](services/vmf-client.md)

---

### copilot-adapter

GitHub Copilot SDK integration.

| Function | Returns | Description |
|----------|---------|-------------|
| `initCopilot()` | `Promise<void>` | Initializes Copilot client |
| `checkCopilotStatus()` | `Promise<StatusInfo>` | Gets CLI status |
| `checkCopilotAuth()` | `Promise<AuthInfo>` | Gets auth status |
| `listModels(options)` | `Promise<Model[]>` | Lists available models |
| `generateAltText(imagePath, options)` | `Promise<{altText, raw}>` | Generates alt text |
| `generateAltTextWithFolder(...)` | `Promise<FolderSuggestion>` | Suggests folder |

[Full documentation →](services/copilot-adapter.md)

---

### credential-store

Secure credential storage using OS keychain.

| Function | Returns | Description |
|----------|---------|-------------|
| `saveCredentials(siteId, creds)` | `Promise<Object>` | Saves encrypted creds |
| `getCredentials(siteId)` | `Promise<Credentials\|undefined>` | Gets decrypted creds |
| `deleteCredentials(siteId)` | `Promise<void>` | Deletes creds |
| `listSites()` | `Promise<Site[]>` | Lists sites (no passwords) |

[Full documentation →](services/credential-store.md)

---

### job-queue

Concurrent job processing with retry logic.

```javascript
import { JobQueue } from './services/job-queue.js'

const queue = new JobQueue({
  concurrency: 3,  // Max parallel workers
  maxRetries: 3    // Retry attempts per item
})
```

| Method | Returns | Description |
|--------|---------|-------------|
| `createJob(id, items, handler)` | `Job` | Creates a job |
| `start(jobId)` | `Promise<Job>` | Starts job processing |
| `pause(jobId)` | `void` | Pauses a running job |
| `resume(jobId)` | `void` | Resumes paused job |
| `cancel(jobId)` | `void` | Cancels a job |
| `getJob(jobId)` | `Job\|undefined` | Gets job by ID |

**Events:** `job:started`, `job:progress`, `job:finished`

[Full documentation →](services/job-queue.md)

---

### settings-store

Application settings persistence.

| Function | Returns | Description |
|----------|---------|-------------|
| `getSettings()` | `Promise<Settings>` | Gets current settings |
| `saveSettings(settings)` | `Promise<void>` | Saves settings |
| `initSettings()` | `Promise<void>` | Initializes on startup |

[Full documentation →](services/settings-store.md)

---

### thumbnail-cache

Local image caching with LRU eviction.

| Function | Returns | Description |
|----------|---------|-------------|
| `initCache()` | `Promise<void>` | Initializes cache dir |
| `getThumbnailPath(mediaItem)` | `Promise<string>` | Gets/downloads image |
| `clearCache()` | `Promise<void>` | Clears all cached files |

Cache: `$TMPDIR/wp-fotokopilot-cache/` (500 MB max, LRU eviction)

[Full documentation →](services/thumbnail-cache.md)

---

### validation

Alt text validation utilities.

| Function | Returns | Description |
|----------|---------|-------------|
| `validateAltText(text, maxLength)` | `ValidationResult` | Validates alt text |
| `sanitizeAltText(text, maxLength)` | `string` | Cleans alt text |

**Validation Rules:** Max length, no forbidden prefixes, no file extensions, no AI mentions, no keyword stuffing

[Full documentation →](services/validation.md)

---

## Type Definitions

### MediaItem

```typescript
interface MediaItem {
  id: number
  sourceUrl: string
  thumbnailUrl?: string
  filename: string
  title: string
  currentAlt: string
  proposedAlt?: string
  mimeType: string
  suggestedFolder?: FolderSuggestion
}
```

### VmfFolder

```typescript
interface VmfFolder {
  id: number
  name: string
  parentId: number
  count: number
  children: VmfFolder[]
  path: string
}
```

### FolderSuggestion

```typescript
interface FolderSuggestion {
  action: 'existing' | 'new' | 'skip'
  folderId?: number
  folderPath?: string
  newFolderPath?: string
  confidence: number
  reason: string
  visualDescription: string
}
```

### Job

```typescript
interface Job {
  id: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled'
  total: number
  completed: number
  failed: number
  startedAt?: number
  finishedAt?: number
  items: JobItem[]
}
```

### JobProgress

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
    result?: any
    error?: string
  }>
}
```
