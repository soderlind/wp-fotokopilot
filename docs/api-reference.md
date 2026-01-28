# API Reference

## Services

### wp-client

WordPress REST API client for media management.

#### `createWpClient(credentials)`

Creates a new WordPress client instance.

```javascript
import { createWpClient } from './services/wp-client.js'

const client = createWpClient({
  url: 'https://example.com',
  username: 'admin',
  password: 'xxxx xxxx xxxx xxxx'
})
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `testConnection()` | - | `Promise<SiteInfo>` | Tests connection and returns site info |
| `getSiteLocale()` | - | `Promise<string>` | Gets site language locale |
| `getLanguageName(locale)` | `string` | `string` | Converts locale to language name |
| `scanMedia(options)` | `{missingAltOnly, limit, perPage}` | `AsyncGenerator<MediaItem>` | Scans media library |
| `updateAltText(mediaId, altText)` | `number, string` | `Promise<{id, altText}>` | Updates alt text |
| `getMedia(mediaId)` | `number` | `Promise<Object>` | Gets single media item |
| `getUncategorizedMedia(limit)` | `number` | `Promise<MediaItem[]>` | Gets media without folders |
| `listPlugins()` | - | `Promise<Plugin[]>` | Lists installed plugins |
| `installPlugin(slug)` | `string` | `Promise<Plugin>` | Installs plugin from WP.org |
| `activatePlugin(plugin)` | `string` | `Promise<Plugin>` | Activates a plugin |

---

### vmf-client

Virtual Media Folders REST API client.

#### `createVmfClient(credentials)`

Creates a new VMF client instance.

```javascript
import { createVmfClient } from './services/vmf-client.js'

const vmf = createVmfClient({
  url: 'https://example.com',
  username: 'admin',
  password: 'xxxx xxxx xxxx xxxx'
})
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `listFolders()` | - | `Promise<VmfFolder[]>` | Lists folders as tree |
| `createFolder(name, parentId)` | `string, number` | `Promise<VmfFolder>` | Creates a folder |
| `createFolderPath(path)` | `string` | `Promise<VmfFolder>` | Creates nested path |
| `assignMedia(folderId, mediaIds)` | `number, number[]` | `Promise<Array>` | Assigns media to folder |
| `removeMedia(folderId, mediaIds)` | `number, number[]` | `Promise<Array>` | Removes media from folder |
| `getFolder(folderId)` | `number` | `Promise<VmfFolder>` | Gets single folder |
| `deleteFolder(folderId)` | `number` | `Promise<void>` | Deletes a folder |
| `getUncategorizedMedia(limit)` | `number` | `Promise<MediaItem[]>` | Gets unassigned media |
| `getAllAssignedMediaIds()` | - | `Promise<Object>` | Gets assignment info |

---

### copilot-adapter

GitHub Copilot SDK integration.

#### Functions

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `initCopilot()` | - | `Promise<void>` | Initializes Copilot client |
| `stopCopilot()` | - | `Promise<void>` | Stops Copilot client |
| `checkCopilotStatus()` | - | `Promise<StatusInfo>` | Gets CLI status |
| `checkCopilotAuth()` | - | `Promise<AuthInfo>` | Gets auth status |
| `setCliServerUrl(url)` | `string\|null` | `void` | Sets custom CLI URL |
| `getCliServerUrl()` | - | `string\|null` | Gets current CLI URL |
| `listModels(options)` | `{visionOnly}` | `Promise<Model[]>` | Lists available models |
| `generateAltText(imagePath, options)` | `string, {maxLength, model}` | `Promise<{altText, raw}>` | Generates alt text |
| `suggestFolder(imagePath, options)` | `string, {...}` | `Promise<FolderSuggestion>` | Suggests folder |

---

### credential-store

Secure credential storage using OS keychain.

#### Functions

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `saveCredentials(siteId, creds)` | `string, Object` | `Promise<Object>` | Saves encrypted creds |
| `getCredentials(siteId)` | `string` | `Promise<Credentials\|undefined>` | Gets decrypted creds |
| `deleteCredentials(siteId)` | `string` | `Promise<void>` | Deletes creds |
| `listSites()` | - | `Promise<Site[]>` | Lists sites (no passwords) |

---

### job-queue

Concurrent job processing with retry logic.

#### `new JobQueue(options)`

Creates a job queue instance.

```javascript
import { JobQueue } from './services/job-queue.js'

const queue = new JobQueue({
  concurrency: 3,  // Max parallel workers
  maxRetries: 3    // Retry attempts per item
})
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `createJob(id, items, handler)` | `string, Array, Function` | `Job` | Creates a job |
| `start(jobId)` | `string` | `Promise<Job>` | Starts job processing |
| `pause(jobId)` | `string` | `void` | Pauses a running job |
| `resume(jobId)` | `string` | `void` | Resumes paused job |
| `cancel(jobId)` | `string` | `void` | Cancels a job |
| `getJob(jobId)` | `string` | `Job\|undefined` | Gets job by ID |
| `clearJob(jobId)` | `string` | `void` | Removes job from queue |
| `getStats()` | - | `QueueStats` | Gets queue statistics |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `job:started` | `{jobId}` | Job started processing |
| `job:progress` | `JobProgress` | Progress update |
| `job:finished` | `{jobId, status, completed, failed, duration}` | Job completed |

---

### settings-store

Application settings persistence.

#### Functions

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `getSettings()` | - | `Promise<Settings>` | Gets current settings |
| `saveSettings(settings)` | `Partial<Settings>` | `Promise<void>` | Saves settings |
| `initSettings()` | - | `Promise<void>` | Initializes on startup |

#### Default Settings

```javascript
{
  maxAltLength: 125,      // Max alt text characters
  concurrency: 3,         // Parallel job workers
  exportFormat: 'csv',    // Export format
  copilotServerUrl: '',   // Custom CLI URL (empty = auto)
  copilotModel: 'gpt-4o', // Default AI model
}
```

---

### thumbnail-cache

Local image caching with LRU eviction.

#### Functions

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `initCache()` | - | `Promise<void>` | Initializes cache dir |
| `getThumbnailPath(mediaItem)` | `MediaItem` | `Promise<string>` | Gets/downloads image |
| `clearCache()` | - | `Promise<void>` | Clears all cached files |

Cache location: `$TMPDIR/wp-fotokopilot-cache/`  
Max size: 500 MB (LRU eviction)

---

### validation

Alt text validation utilities.

#### Functions

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `validateAltText(text, maxLength)` | `string, number` | `ValidationResult` | Validates alt text |
| `sanitizeAltText(text, maxLength)` | `string, number` | `string` | Cleans alt text |

#### Validation Rules

- Maximum length (default: 125 characters)
- No forbidden prefixes ("Image of", "Photo of", etc.)
- No file extensions in text
- No AI mentions (ChatGPT, Copilot, etc.)
- No filename patterns
- No keyword stuffing

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
