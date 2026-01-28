# thumbnail-cache

Local thumbnail cache with LRU eviction for Copilot vision analysis.

**Module:** `main/services/thumbnail-cache`  
**Source:** [src/main/services/thumbnail-cache.js](../src/main/services/thumbnail-cache.js)

## Overview

This module manages a local cache of image thumbnails:

- Downloads and caches images from WordPress
- Uses LRU (Least Recently Used) eviction when cache exceeds size limit
- Provides local file paths for Copilot vision analysis

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `CACHE_DIR` | `$TMPDIR/wp-fotokopilot-cache` | Cache directory path |
| `MAX_CACHE_SIZE` | `500 * 1024 * 1024` (500 MB) | Maximum cache size |

---

## Functions

### initCache()

Initializes the cache directory.

```javascript
import { initCache } from './services/thumbnail-cache.js'

await initCache()
```

**Returns:** `Promise<void>`

**Behavior:**
- Creates cache directory if it doesn't exist
- Called automatically by `getThumbnailPath()` if needed

---

### getThumbnailPath(mediaItem)

Gets or downloads a thumbnail to the local cache.

```javascript
import { getThumbnailPath } from './services/thumbnail-cache.js'

const localPath = await getThumbnailPath({
  thumbnailUrl: 'https://example.com/wp-content/uploads/image-150x150.jpg',
  sourceUrl: 'https://example.com/wp-content/uploads/image.jpg'
})

// Use with Copilot
const result = await generateAltText(localPath)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `mediaItem.thumbnailUrl` | `string` | Thumbnail URL (preferred) |
| `mediaItem.sourceUrl` | `string` | Full image URL (fallback) |

**Returns:** `Promise<string>` — Local file path to the cached thumbnail

**Throws:** `Error` if no image URL available or download fails

**Behavior:**

1. Creates hash from URL for filename
2. Checks if already cached
3. Downloads if not cached
4. Updates LRU timestamp
5. Evicts old files if cache exceeds limit
6. Returns local file path

---

### clearCache()

Clears all cached files.

```javascript
import { clearCache } from './services/thumbnail-cache.js'

await clearCache()
```

**Returns:** `Promise<void>`

---

## Cache Strategy

### File Naming

Files are named using a SHA-256 hash of the URL:

```
https://example.com/image.jpg → 7a8b9c0d1e2f3a4b.jpg
```

### LRU Eviction

When cache exceeds `MAX_CACHE_SIZE`:

1. Get all files with stats
2. Sort by last access time (oldest first)
3. Delete oldest files until under limit

```javascript
// LRU tracking
const lruOrder = new Map()  // hash → timestamp

// Update on access
lruOrder.set(hash, Date.now())
```

---

## Cache Location

```bash
# macOS
/var/folders/xx/.../T/wp-fotokopilot-cache/

# Windows
%TEMP%\wp-fotokopilot-cache\

# Linux
/tmp/wp-fotokopilot-cache/
```

---

## Usage Example

### Alt Text Generation with Cache

```javascript
import { getThumbnailPath } from './services/thumbnail-cache.js'
import { generateAltText } from './services/copilot-adapter.js'

async function generateForMedia(mediaItem) {
  try {
    // Download/retrieve from cache
    const localPath = await getThumbnailPath(mediaItem)
    
    // Send local file to Copilot
    const result = await generateAltText(localPath)
    
    return result.altText
  } catch (err) {
    console.error(`Failed for ${mediaItem.id}:`, err.message)
    throw err
  }
}
```

### Batch Processing

```javascript
import { getThumbnailPath, initCache } from './services/thumbnail-cache.js'

// Initialize cache once at startup
await initCache()

// Process multiple items (cache prevents re-downloads)
for (const item of mediaItems) {
  const path = await getThumbnailPath(item)
  // First call downloads, subsequent calls return cached path
}
```

---

## Internal Helpers

### extractExtension(url)

Extracts file extension from a URL.

```javascript
extractExtension('https://example.com/image.jpg')  // 'jpg'
extractExtension('https://example.com/file')       // 'jpg' (default)
```

**Returns:** `string` — File extension (defaults to `'jpg'`)

### evictIfNeeded()

Evicts least recently used files if cache exceeds size limit.

**Behavior:**

1. Read all files in cache directory
2. Sum total size
3. If over limit, sort by access time
4. Delete oldest files until under limit
