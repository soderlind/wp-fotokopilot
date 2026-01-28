# vmf-client

Virtual Media Folders (VMF) REST API client for folder management and media organization.

**Module:** `main/services/vmf-client`  
**Source:** [src/main/services/vmf-client.js](../src/main/services/vmf-client.js)

## Type Definitions

### VmfFolder

Folder structure from the VMF API.

```typescript
interface VmfFolder {
  /** Folder ID */
  id: number
  /** Folder name */
  name: string
  /** Parent folder ID (0 for root) */
  parentId: number
  /** Number of media items in folder */
  count: number
  /** Child folders */
  children: VmfFolder[]
  /** Full folder path (e.g., 'Category/Subcategory') */
  path: string
}
```

---

## Factory Function

### createVmfClient(credentials)

Creates a VMF REST API client instance.

```javascript
import { createVmfClient } from './services/vmf-client.js'

const vmf = createVmfClient({
  url: 'https://example.com',
  username: 'admin',
  password: 'xxxx xxxx xxxx xxxx'
})
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `credentials.url` | `string` | WordPress site URL |
| `credentials.username` | `string` | WordPress username |
| `credentials.password` | `string` | Application password |

**Returns:** `Object` — VMF client with API methods

---

## Methods

### listFolders()

Lists all folders as a hierarchical tree.

```javascript
const folders = await vmf.listFolders()

function printTree(folders, indent = 0) {
  for (const folder of folders) {
    console.log('  '.repeat(indent) + folder.name, `(${folder.count})`)
    printTree(folder.children, indent + 1)
  }
}
printTree(folders)
```

**Returns:** `Promise<VmfFolder[]>` — Root-level folders with nested children

**Example Output:**

```
Products (15)
  Electronics (8)
  Clothing (7)
People (25)
  Team (12)
  Events (13)
```

---

### createFolder(name, parentId)

Creates a new folder.

```javascript
const folder = await vmf.createFolder('New Products', 0)  // Root level
const sub = await vmf.createFolder('2024 Collection', folder.id)  // Subfolder
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | — | Folder name |
| `parentId` | `number` | `0` | Parent folder ID (0 for root) |

**Returns:** `Promise<VmfFolder>` — Created folder

---

### createFolderPath(path)

Creates a folder path, creating any missing parent folders.

```javascript
// Creates 'Products', then 'Products/Electronics', then 'Products/Electronics/Phones'
const folder = await vmf.createFolderPath('Products/Electronics/Phones')
console.log(folder.id)  // ID of the 'Phones' folder
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Folder path like `'Category/Subcategory/Deep'` |

**Returns:** `Promise<VmfFolder>` — The deepest (leaf) folder

**Behavior:**

1. Splits path by `/`
2. For each segment, checks if folder exists at that level
3. Creates missing folders as needed
4. Returns the final folder

---

### assignMedia(folderId, mediaIds)

Assigns media items to a folder.

```javascript
// Single item
await vmf.assignMedia(123, 456)

// Multiple items
await vmf.assignMedia(123, [456, 789, 1011])
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `folderId` | `number` | Target folder ID |
| `mediaIds` | `number \| number[]` | Media ID(s) to assign |

**Returns:** `Promise<Array>` — Assignment results for each media item

---

### removeMedia(folderId, mediaIds)

Removes media items from a folder.

```javascript
await vmf.removeMedia(123, [456, 789])
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `folderId` | `number` | Folder ID |
| `mediaIds` | `number \| number[]` | Media ID(s) to remove |

**Returns:** `Promise<Array>` — Removal results for each media item

---

### getFolder(folderId)

Gets a single folder by ID.

```javascript
const folder = await vmf.getFolder(123)
console.log(folder.name, folder.count)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `folderId` | `number` | Folder ID |

**Returns:** `Promise<VmfFolder>`

---

### deleteFolder(folderId)

Deletes a folder.

```javascript
await vmf.deleteFolder(123)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `folderId` | `number` | Folder ID |

**Returns:** `Promise<void>`

**Note:** Behavior when folder has media or children depends on VMF configuration.

---

### getFolderCounts()

Gets folder counts from the VMF API.

```javascript
const counts = await vmf.getFolderCounts()
```

**Returns:** `Promise<Object>` — Folder count information

---

### getUncategorizedMedia(limit)

Gets media not assigned to any folder.

```javascript
const items = await vmf.getUncategorizedMedia(50)
items.forEach(item => {
  console.log(item.id, item.filename)
})
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `limit` | `number` | `50` | Maximum items to return |

**Returns:** `Promise<MediaItem[]>` — Uncategorized media items

**Throws:** `Error` if the endpoint is not available (falls back to wp-client method)

---

### getAllAssignedMediaIds()

Gets information about all assigned media.

```javascript
const info = await vmf.getAllAssignedMediaIds()
console.log(`${info.totalAssigned} media in ${info.folderCount} folders`)
```

**Returns:**

```typescript
Promise<{
  /** Number of folders */
  folderCount: number
  /** Total media assignments */
  totalAssigned: number
  /** List of folder IDs */
  folderIds: number[]
}>
```

**Note:** Returns aggregate counts, not actual media IDs. For per-item filtering, check the `vmfo_folder` taxonomy on each media item.

---

### getFolderMedia(folderId) ⚠️ Deprecated

Gets media items in a specific folder.

```javascript
const media = await vmf.getFolderMedia(123)  // Always returns []
```

**Returns:** `Promise<Array>` — Always returns empty array

**Deprecation Notice:** VMF doesn't have a GET endpoint for folder media. Use `getAllAssignedMediaIds()` and check taxonomy instead.

---

## Private Helpers

### buildFolderTree(flatFolders)

Builds a hierarchical tree from flat folder list.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `flatFolders` | `Array` | Flat array of folders from API |

**Returns:** `VmfFolder[]` — Hierarchical folder tree

### findFolderByNameAndParent(tree, name, parentId)

Finds a folder by name and parent ID in the tree.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `tree` | `VmfFolder[]` | Folder tree to search |
| `name` | `string` | Folder name to find |
| `parentId` | `number` | Expected parent ID |

**Returns:** `VmfFolder | undefined`

---

## Error Handling

```javascript
try {
  await vmf.createFolder('Products')
} catch (err) {
  if (err.code === 'VMF_ERROR') {
    console.error('VMF API error:', err.message)
    console.error('HTTP status:', err.status)
  }
}
```

| Error Code | Description |
|------------|-------------|
| `VMF_ERROR` | General VMF API error |
| `WP_ERROR` | WordPress REST API error |

---

## Usage with Folder Suggestions

The VMF client is typically used with the Copilot adapter for folder organization:

```javascript
import { createVmfClient } from './services/vmf-client.js'
import { suggestFolder } from './services/copilot-adapter.js'

const vmf = createVmfClient(credentials)

// Get existing folders for context
const folders = await vmf.listFolders()
const flatFolders = flattenTree(folders)

// Get AI suggestion
const suggestion = await suggestFolder(imagePath, {
  existingFolders: flatFolders,
  languageName: 'English'
})

// Apply suggestion
if (suggestion.action === 'existing') {
  await vmf.assignMedia(suggestion.folderId, mediaId)
} else if (suggestion.action === 'new') {
  const newFolder = await vmf.createFolderPath(suggestion.newFolderPath)
  await vmf.assignMedia(newFolder.id, mediaId)
}
```
