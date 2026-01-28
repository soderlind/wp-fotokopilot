# settings-store

Application settings storage and management.

**Module:** `main/services/settings-store`  
**Source:** [src/main/services/settings-store.js](../src/main/services/settings-store.js)

## Overview

This module manages user preferences and app configuration:

- Persisted to disk using electron-store
- Merged with defaults on read
- Syncs with dependent services on save

---

## Type Definitions

### AppSettings

Application settings object.

```typescript
interface AppSettings {
  /** Maximum alt text length (default: 125) */
  maxAltLength: number
  /** Concurrent job workers (default: 3) */
  concurrency: number
  /** Export format: 'csv' or 'json' */
  exportFormat: 'csv' | 'json'
  /** Custom Copilot CLI server URL (empty = auto) */
  copilotServerUrl: string
  /** Model ID for alt text generation */
  copilotModel: string
}
```

---

## Default Settings

```javascript
const DEFAULT_SETTINGS = {
  maxAltLength: 125,
  concurrency: 3,
  exportFormat: 'csv',
  copilotServerUrl: '',  // Empty = use auto-managed CLI
  copilotModel: 'gpt-4o'
}
```

---

## Functions

### getSettings()

Gets the current application settings merged with defaults.

```javascript
import { getSettings } from './services/settings-store.js'

const settings = await getSettings()

console.log(settings.maxAltLength)     // 125
console.log(settings.concurrency)      // 3
console.log(settings.copilotModel)     // 'gpt-4o'
```

**Returns:** `Promise<AppSettings>`

**Behavior:**
- Returns defaults merged with any saved settings
- Missing settings use default values
- New defaults are automatically included

---

### saveSettings(settings)

Saves application settings and syncs with dependent services.

```javascript
import { saveSettings } from './services/settings-store.js'

await saveSettings({
  maxAltLength: 150,
  copilotModel: 'claude-sonnet-4'
})
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `settings` | `Partial<AppSettings>` | Settings to update |

**Returns:** `Promise<void>`

**Behavior:**
- Merges with existing settings
- Syncs `copilotServerUrl` with copilot-adapter
- Only updates provided keys

---

### initSettings()

Initializes settings on app startup.

```javascript
import { initSettings } from './services/settings-store.js'

// In main process startup
await initSettings()
```

**Returns:** `Promise<void>`

**Behavior:**
- Reads stored settings
- Syncs `copilotServerUrl` with copilot-adapter
- Called automatically during app initialization

---

## Service Syncing

When settings change, dependent services are automatically updated:

| Setting | Service | Effect |
|---------|---------|--------|
| `copilotServerUrl` | copilot-adapter | Updates CLI connection URL |

---

## Storage Location

```bash
# macOS
~/Library/Application Support/wp-fotokopilot/wp-fotokopilot-settings.json

# Windows
%APPDATA%\wp-fotokopilot\wp-fotokopilot-settings.json

# Linux
~/.config/wp-fotokopilot/wp-fotokopilot-settings.json
```

---

## Usage Example

### Settings Management Flow

```javascript
import { getSettings, saveSettings, initSettings } from './services/settings-store.js'

// On app startup
app.whenReady().then(async () => {
  await initSettings()
  // ... continue initialization
})

// In settings handler
async function handleSettingsGet() {
  return await getSettings()
}

async function handleSettingsSet(newSettings) {
  await saveSettings(newSettings)
}
```

### Using Settings in Jobs

```javascript
import { getSettings } from './services/settings-store.js'
import { JobQueue } from './services/job-queue.js'
import { generateAltText } from './services/copilot-adapter.js'

async function createAltTextJob(items) {
  const settings = await getSettings()
  
  const queue = new JobQueue({
    concurrency: settings.concurrency
  })
  
  return queue.createJob('alt-text', items, async (item) => {
    const result = await generateAltText(item.path, {
      maxLength: settings.maxAltLength,
      model: settings.copilotModel
    })
    return result
  })
}
```
