# credential-store

Secure credential storage using Electron's safeStorage API.

**Module:** `main/services/credential-store`  
**Source:** [src/main/services/credential-store.js](../src/main/services/credential-store.js)

## Overview

This module provides secure storage for WordPress site credentials using:

- **Electron safeStorage** — Encrypts data using the OS keychain
- **electron-store** — Persists encrypted data to disk

Credentials are never stored in plain text.

---

## Type Definitions

### SiteCredentials

Complete site credentials object.

```typescript
interface SiteCredentials {
  /** Unique site identifier */
  id: string
  /** WordPress site URL */
  url: string
  /** WordPress username */
  username: string
  /** Application password */
  password: string
  /** Site display name (optional) */
  name?: string
  /** Site capabilities (REST API, VMF support) */
  capabilities?: {
    rest: boolean
    vmf: boolean
  }
}
```

---

## Functions

### saveCredentials(siteId, credentials)

Saves site credentials securely using OS keychain encryption.

```javascript
import { saveCredentials } from './services/credential-store.js'

const saved = await saveCredentials('my-site', {
  url: 'https://example.com',
  username: 'admin',
  password: 'xxxx xxxx xxxx xxxx',
  name: 'My WordPress Site',
  capabilities: { rest: true, vmf: true }
})

console.log(saved.id)   // 'my-site'
console.log(saved.url)  // 'https://example.com'
// Note: password is NOT returned
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `siteId` | `string` | Unique site identifier |
| `credentials.url` | `string` | WordPress site URL |
| `credentials.username` | `string` | WordPress username |
| `credentials.password` | `string` | Application password |
| `credentials.name` | `string` | Site display name (optional) |
| `credentials.capabilities` | `object` | Site capabilities (optional) |

**Returns:** `Promise<{id: string, url: string, ...metadata}>` — Saved site info (without password)

**Throws:** `Error` if secure storage is not available

**Storage Format:**

```javascript
// Data on disk (credentials encrypted)
{
  "sites": {
    "my-site": {
      "id": "my-site",
      "credentials": "base64EncodedEncryptedString",
      "name": "My WordPress Site",
      "capabilities": { "rest": true, "vmf": true }
    }
  }
}
```

---

### getCredentials(siteId)

Retrieves decrypted credentials for a site.

```javascript
import { getCredentials } from './services/credential-store.js'

const creds = await getCredentials('my-site')

if (creds) {
  console.log(creds.url)       // 'https://example.com'
  console.log(creds.username)  // 'admin'
  console.log(creds.password)  // 'xxxx xxxx xxxx xxxx' (decrypted)
}
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `siteId` | `string` | Unique site identifier |

**Returns:** `Promise<SiteCredentials | undefined>` — Decrypted credentials or undefined if not found

**Throws:** `Error` if secure storage is not available

---

### deleteCredentials(siteId)

Deletes stored credentials for a site.

```javascript
import { deleteCredentials } from './services/credential-store.js'

await deleteCredentials('my-site')
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `siteId` | `string` | Unique site identifier |

**Returns:** `Promise<void>`

---

### listSites()

Lists all stored sites (without credentials).

```javascript
import { listSites } from './services/credential-store.js'

const sites = await listSites()

sites.forEach(site => {
  console.log(site.id, site.name, site.url)
  console.log('VMF:', site.capabilities?.vmf)
})
```

**Returns:**

```typescript
Promise<Array<{
  id: string
  name: string
  url: string
  capabilities: { rest: boolean, vmf: boolean }
}>>
```

**Note:** Does not include `username` or `password` fields for security.

---

## Security Model

### Encryption

1. Credentials (url, username, password) are JSON-stringified
2. Encrypted using `safeStorage.encryptString()`
3. Stored as base64 in electron-store

### Decryption

1. Read base64 string from electron-store
2. Decode to Buffer
3. Decrypt using `safeStorage.decryptString()`
4. Parse JSON to retrieve credentials

### OS Integration

| Platform | Backend |
|----------|---------|
| macOS | Keychain |
| Windows | DPAPI |
| Linux | libsecret / kwallet |

---

## Storage Location

```bash
# macOS
~/Library/Application Support/wp-fotokopilot/wp-fotokopilot-credentials.json

# Windows
%APPDATA%\wp-fotokopilot\wp-fotokopilot-credentials.json

# Linux
~/.config/wp-fotokopilot/wp-fotokopilot-credentials.json
```

---

## Error Handling

```javascript
try {
  await saveCredentials('my-site', { url, username, password })
} catch (err) {
  if (err.message.includes('Secure storage not available')) {
    // OS keychain not available
    console.error('Cannot save credentials securely')
  }
}
```

---

## Usage Example

### Site Management Flow

```javascript
import {
  saveCredentials,
  getCredentials,
  deleteCredentials,
  listSites
} from './services/credential-store.js'
import { createWpClient } from './services/wp-client.js'

// Connect to site
async function connectSite(siteId, url, username, password) {
  // Test connection first
  const client = createWpClient({ url, username, password })
  const info = await client.testConnection()
  
  // Save credentials if successful
  await saveCredentials(siteId, {
    url,
    username,
    password,
    name: info.name,
    capabilities: info.capabilities
  })
  
  return info
}

// Get client for saved site
async function getClient(siteId) {
  const creds = await getCredentials(siteId)
  if (!creds) throw new Error('Site not found')
  
  return createWpClient(creds)
}

// Disconnect site
async function disconnectSite(siteId) {
  await deleteCredentials(siteId)
}
```
