# IPC Communication

WP FotoKopilot uses Electron's IPC (Inter-Process Communication) for secure communication between the renderer and main processes.

## Overview

```
Renderer Process                    Main Process
     │                                   │
     │  ipcRenderer.invoke('channel')    │
     │ ─────────────────────────────────►│
     │                                   │ Handler processes request
     │  Promise resolves with result     │
     │ ◄─────────────────────────────────│
     │                                   │
```

## Security

All IPC communication goes through the preload script, which:

1. **Validates senders** - Only accepts requests from localhost or file:// URLs
2. **Exposes limited API** - Only specific functions are available to renderer
3. **Uses invoke/handle** - Async request/response pattern (not send/on)

```javascript
// router.js - Sender validation
function validateSender(event) {
  const url = event.senderFrame?.url
  if (!url) return false
  return url.startsWith('http://localhost:') || url.startsWith('file://')
}
```

## Channel Reference

### Site Management

| Channel | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `site:add` | `{id, url, username, password}` | `SiteInfo` | Add new site |
| `site:remove` | `id` | `{success}` | Remove site |
| `site:list` | - | `Site[]` | List all sites |
| `site:test` | `{url, username, password}` | `SiteInfo` | Test connection |
| `site:get` | `id` | `Credentials` | Get site credentials |
| `site:refresh` | `id` | `SiteInfo` | Refresh site capabilities |

### Plugin Management

| Channel | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `plugin:install` | `{siteId, slug}` | `PluginInfo` | Install/activate plugin |

### Media Scanning

| Channel | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `scan:start` | `{siteId, missingAltOnly, limit}` | - | Start media scan |
| `scan:cancel` | - | - | Cancel current scan |
| `media:scan` | `{siteId, ...options}` | `MediaItem[]` | Alternative scan endpoint |

**Events (main → renderer):**

| Event | Payload | Description |
|-------|---------|-------------|
| `scan:item` | `MediaItem` | New item scanned |
| `scan:complete` | `{total}` | Scan completed |

### Job Queue

| Channel | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `job:start` | `{type, siteId, items, options}` | `{jobId}` | Start new job |
| `job:pause` | `jobId` | - | Pause job |
| `job:resume` | `jobId` | - | Resume job |
| `job:cancel` | `jobId` | - | Cancel job |
| `job:get` | `jobId` | `Job` | Get job status |
| `job:export` | `{jobId, format}` | `{path}` | Export results |

**Events (main → renderer):**

| Event | Payload | Description |
|-------|---------|-------------|
| `job:progress` | `JobProgress` | Progress update |

### Virtual Media Folders

| Channel | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `vmf:list` | `{siteId}` | `VmfFolder[]` | List folder tree |
| `vmf:create` | `{siteId, name, parentId}` | `VmfFolder` | Create folder |
| `vmf:createPath` | `{siteId, path}` | `VmfFolder` | Create nested path |
| `vmf:assign` | `{siteId, folderId, mediaIds}` | `Result[]` | Assign media |
| `vmf:uncategorized` | `{siteId, limit}` | `MediaItem[]` | Get unassigned media |

### Settings

| Channel | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `settings:get` | - | `Settings` | Get all settings |
| `settings:set` | `Partial<Settings>` | - | Update settings |

### GitHub Copilot

| Channel | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `copilot:status` | - | `StatusInfo` | Get CLI status |
| `copilot:auth` | - | `AuthInfo` | Get auth status |
| `copilot:setServerUrl` | `url` | `{success, url}` | Set custom CLI URL |
| `copilot:getServerUrl` | - | `{url}` | Get CLI URL |
| `copilot:listModels` | `{visionOnly}` | `Model[]` | List models |

## Usage Examples

### Renderer Side

```javascript
// Using the hook
import { useElectronAPI } from '../hooks/useElectronAPI'

function MyComponent() {
  const api = useElectronAPI()
  
  const handleConnect = async () => {
    try {
      const info = await api.site.add({
        id: 'my-site',
        url: 'https://example.com',
        username: 'admin',
        password: 'xxxx xxxx xxxx xxxx'
      })
      console.log('Connected:', info.name)
    } catch (err) {
      console.error('Failed:', err.message)
    }
  }
}
```

### Subscribing to Events

```javascript
import { useEffect } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'

function ScanProgress() {
  const api = useElectronAPI()
  const [items, setItems] = useState([])
  
  useEffect(() => {
    // Subscribe to scan events
    const unsubscribe = api.scan.onItem((item) => {
      setItems(prev => [...prev, item])
    })
    
    // Cleanup on unmount
    return unsubscribe
  }, [api])
}
```

### Main Process Handler

```javascript
// In handlers file
export function myHandlers(mainWindow) {
  return [
    {
      channel: 'my:action',
      async handler(param1, param2) {
        // Access services
        const client = await getClient(param1)
        const result = await client.doSomething(param2)
        
        // Optionally emit events to renderer
        mainWindow.webContents.send('my:event', { data: result })
        
        return result
      }
    }
  ]
}
```

## Error Handling

Errors thrown in handlers are serialized and sent to the renderer:

```javascript
// Handler
async handler(siteId) {
  const site = await getCredentials(siteId)
  if (!site) {
    throw new Error('Site not found')
  }
  // ...
}

// Renderer
try {
  await api.site.get('invalid-id')
} catch (err) {
  console.error(err.message) // "Site not found"
}
```

## Best Practices

1. **Always use invoke/handle** - Never use send/on for request/response
2. **Return serializable data** - No functions, circular refs, or class instances
3. **Handle errors** - Wrap handlers in try/catch, throw meaningful errors
4. **Validate input** - Check parameters before processing
5. **Use typed channels** - Namespace channels (e.g., `site:add`, `vmf:list`)
6. **Emit progress for long operations** - Use events for real-time updates
