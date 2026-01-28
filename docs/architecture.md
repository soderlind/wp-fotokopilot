# Architecture Overview

## Process Model

WP FotoKopilot follows Electron's multi-process architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ IPC Router  │  │  Services   │  │   Job Queue         │  │
│  │             │  │             │  │                     │  │
│  │ - site.*    │  │ - wp-client │  │ - Concurrent tasks  │  │
│  │ - scan.*    │  │ - vmf-client│  │ - Retry logic       │  │
│  │ - job.*     │  │ - copilot   │  │ - Progress events   │  │
│  │ - vmf.*     │  │ - creds     │  │                     │  │
│  │ - copilot.* │  │ - settings  │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC (contextBridge)
┌──────────────────────────┴──────────────────────────────────┐
│                   Renderer Process                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   React     │  │   Zustand   │  │    Hooks            │  │
│  │             │  │             │  │                     │  │
│  │ - App.jsx   │  │ - appStore  │  │ - useElectronAPI    │  │
│  │ - Tabs      │  │ - sites     │  │ - useJobProgress    │  │
│  │ - Grids     │  │ - media     │  │ - useScanProgress   │  │
│  │ - Modals    │  │ - jobs      │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Security Model

### Context Isolation

The app uses Electron's recommended security practices:

- **Context Isolation**: Enabled - renderer cannot access Node.js
- **Sandbox**: Enabled - renderer runs in restricted environment
- **Node Integration**: Disabled - no Node.js in renderer
- **Preload Script**: Exposes limited API via `contextBridge`

### Credential Storage

Credentials are stored securely using:

1. **Electron safeStorage** - Encrypts data using OS keychain
2. **electron-store** - Persists encrypted credentials to disk

```javascript
// Credentials are encrypted before storage
const encrypted = safeStorage.encryptString(JSON.stringify(credentials))
store.set('sites', { [siteId]: { credentials: encrypted.toString('base64') } })
```

## Data Flow

### Alt Text Generation Flow

```
1. User selects media items
2. Renderer: job.start({ type: 'alt-text', items })
       │
       ▼
3. Main: JobQueue creates job, starts processing
       │
       ▼
4. Main: For each item:
   - Download thumbnail to cache
   - Send to Copilot SDK with image
   - Receive alt text response
   - Emit progress event
       │
       ▼
5. Renderer: useJobProgress() receives updates
       │
       ▼
6. UI updates with proposed alt text
```

### Folder Organization Flow

```
1. User scans uncategorized media
2. Renderer: vmf.uncategorized(siteId)
       │
       ▼
3. Main: Fetch media with _embed, check vmfo_folder taxonomy
       │
       ▼
4. User selects media, clicks "Suggest Folders"
5. Main: For each item:
   - Analyze image with Copilot vision
   - Match to existing folders or suggest new
   - Return suggestion with confidence
       │
       ▼
6. User reviews Assignment Preview
7. User clicks "Apply All Suggestions"
8. Main: Create new folders, assign media
```

## Service Layer

### wp-client.js

WordPress REST API client for:
- Connection testing
- Media scanning (with pagination)
- Alt text updates
- Plugin management

### vmf-client.js

Virtual Media Folders API client for:
- Folder CRUD operations
- Media assignment/removal
- Folder path creation

### copilot-adapter.js

GitHub Copilot SDK wrapper for:
- Alt text generation (vision)
- Folder suggestion (vision)
- Model listing
- Status/auth checking

### job-queue.js

Concurrent job processor with:
- Configurable concurrency (default: 3)
- Exponential backoff retry (max: 3 attempts)
- Pause/resume/cancel
- Progress events

## State Management

### Zustand Store

The app uses a single Zustand store (`appStore.js`) for:

```javascript
{
  activeSiteId,      // Currently selected site
  sites,             // Connected WordPress sites
  mediaItems,        // Scanned media items
  selectedItems,     // Selected media IDs
  folders,           // VMF folder structure
  currentJob,        // Active job state
  settings,          // App configuration
}
```

### Progress Events

Jobs emit progress via IPC:

```javascript
{
  jobId,
  status,      // 'running' | 'paused' | 'completed' | 'cancelled'
  total,       // Total items
  completed,   // Completed items
  failed,      // Failed items
  items: [{
    id,
    status,      // 'pending' | 'processing' | 'completed' | 'failed'
    proposedAlt, // Generated alt text (for alt-text jobs)
    result,      // Full result object (for folder jobs)
    error,       // Error message if failed
  }]
}
```
