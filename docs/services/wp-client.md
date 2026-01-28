# wp-client

WordPress REST API client for media management.

**Module:** `main/services/wp-client`  
**Source:** [src/main/services/wp-client.js](../src/main/services/wp-client.js)

## Type Definitions

### WpCredentials

WordPress site connection credentials.

```typescript
interface WpCredentials {
  /** WordPress site URL */
  url: string
  /** WordPress username */
  username: string
  /** Application password */
  password: string
}
```

### MediaItem

Normalized media item from WordPress.

```typescript
interface MediaItem {
  /** WordPress media ID */
  id: number
  /** Full image URL */
  sourceUrl: string
  /** Thumbnail URL (optional) */
  thumbnailUrl?: string
  /** Original filename/slug */
  filename: string
  /** Media title */
  title: string
  /** Current alt text */
  currentAlt: string
  /** MIME type */
  mimeType: string
}
```

### SiteInfo

WordPress site information returned by connection test.

```typescript
interface SiteInfo {
  /** Site name */
  name: string
  /** Site description */
  description: string
  /** Site URL */
  url: string
  /** Site language locale (e.g., 'en_US') */
  locale: string
  /** Available features */
  capabilities: {
    /** REST API available */
    rest: boolean
    /** Virtual Media Folders plugin active */
    vmf: boolean
  }
}
```

---

## Factory Function

### createWpClient(credentials)

Creates a WordPress REST API client instance.

```javascript
import { createWpClient } from './services/wp-client.js'

const client = createWpClient({
  url: 'https://example.com',
  username: 'admin',
  password: 'xxxx xxxx xxxx xxxx'
})
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `credentials` | `WpCredentials` | WordPress site credentials |

**Returns:** `Object` — WordPress client with API methods

---

## Methods

### testConnection()

Tests connection and retrieves site information.

```javascript
const info = await client.testConnection()
console.log(info.name)        // "My WordPress Site"
console.log(info.capabilities.vmf)  // true
```

**Returns:** `Promise<SiteInfo>` — Site info with capabilities

**Throws:** 
- `Error` with `code: 'UNAUTHORIZED'` if credentials are invalid
- `Error` with `code: 'FORBIDDEN'` if user lacks permissions

---

### getSiteLocale()

Gets the site's configured locale.

```javascript
const locale = await client.getSiteLocale()
// 'nb_NO'
```

**Returns:** `Promise<string>` — WordPress locale code (e.g., `'en_US'`, `'nb_NO'`)

---

### getLanguageName(locale)

Converts WordPress locale code to human-readable language name.

```javascript
client.getLanguageName('nb_NO')  // 'Norwegian (Bokmål)'
client.getLanguageName('de_DE')  // 'German'
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `locale` | `string` | WordPress locale code |

**Returns:** `string` — Human-readable language name

**Supported Locales:**

| Locale | Language |
|--------|----------|
| `en_US`, `en_GB`, `en_AU` | English |
| `nb_NO` | Norwegian (Bokmål) |
| `nn_NO` | Norwegian (Nynorsk) |
| `sv_SE` | Swedish |
| `da_DK` | Danish |
| `de_DE`, `de_AT`, `de_CH` | German |
| `fr_FR`, `fr_CA` | French |
| `es_ES`, `es_MX` | Spanish |
| And more... | |

---

### scanMedia(options)

Scans media library and yields items as an async generator.

```javascript
for await (const item of client.scanMedia({ missingAltOnly: true, limit: 50 })) {
  console.log(item.id, item.filename, item.currentAlt)
}
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `options.missingAltOnly` | `boolean` | `false` | Only return items without alt text |
| `options.limit` | `number` | `undefined` | Maximum items to return |
| `options.perPage` | `number` | `100` | Items per API request |

**Yields:** `MediaItem` — Media items one at a time

---

### updateAltText(mediaId, altText)

Updates alt text for a media item.

```javascript
const result = await client.updateAltText(123, 'A golden retriever playing fetch')
console.log(result.altText)  // 'A golden retriever playing fetch'
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `mediaId` | `number` | WordPress media ID |
| `altText` | `string` | New alt text |

**Returns:** `Promise<{id: number, altText: string}>`

---

### getMedia(mediaId)

Gets a single media item by ID.

```javascript
const media = await client.getMedia(123)
console.log(media.source_url)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `mediaId` | `number` | WordPress media ID |

**Returns:** `Promise<Object>` — WordPress media object (raw API response)

---

### getUncategorizedMedia(limit)

Gets media items not assigned to any VMF folder.

```javascript
const items = await client.getUncategorizedMedia(50)
items.forEach(item => console.log(item.filename))
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `limit` | `number` | `50` | Maximum items to return |

**Returns:** `Promise<MediaItem[]>` — Uncategorized media items

---

### listPlugins()

Lists all installed plugins.

```javascript
const plugins = await client.listPlugins()
plugins.forEach(p => console.log(p.name, p.status))
```

**Returns:** `Promise<Array<{plugin: string, status: string, name: string}>>`

---

### findPluginBySlug(slug)

Finds a plugin by slug.

```javascript
const vmf = await client.findPluginBySlug('virtual-media-folders')
if (vmf?.status === 'active') {
  console.log('VMF is active')
}
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `slug` | `string` | Plugin slug to search for |

**Returns:** `Promise<{plugin: string, status: string, name: string} | null>`

---

### installPlugin(slug)

Installs and activates a plugin from WordPress.org.

```javascript
const result = await client.installPlugin('virtual-media-folders')
console.log(result.status)  // 'active'
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `slug` | `string` | Plugin slug from wordpress.org |

**Returns:** `Promise<{plugin: string, status: string, name: string}>`

**Throws:** `Error` if installation fails (insufficient permissions, plugin not found, etc.)

---

### activatePlugin(plugin)

Activates an already installed plugin.

```javascript
await client.activatePlugin('virtual-media-folders/virtual-media-folders.php')
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `plugin` | `string` | Plugin identifier (e.g., `'plugin-folder/plugin-file.php'`) |

**Returns:** `Promise<{status: string}>`

---

### getPluginStatus(plugin)

Gets plugin status.

```javascript
const status = await client.getPluginStatus('akismet/akismet.php')
console.log(status?.status)  // 'active' or 'inactive'
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `plugin` | `string` | Plugin identifier |

**Returns:** `Promise<{status: string, name: string} | null>`

---

## Error Handling

The client throws typed errors for common API issues:

```javascript
try {
  await client.testConnection()
} catch (err) {
  switch (err.code) {
    case 'UNAUTHORIZED':
      console.error('Invalid credentials')
      break
    case 'FORBIDDEN':
      console.error('Insufficient permissions')
      break
    case 'RATE_LIMITED':
      console.error(`Rate limited, retry after ${err.retryAfter} seconds`)
      break
    case 'WP_ERROR':
      console.error('WordPress error:', err.message)
      break
  }
}
```

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid credentials |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RATE_LIMITED` | 429 | Too many requests |
| `WP_ERROR` | Various | WordPress API error |
