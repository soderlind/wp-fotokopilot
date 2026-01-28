# copilot-adapter

GitHub Copilot SDK integration for AI-powered alt text generation and folder organization.

**Module:** `main/services/copilot-adapter`  
**Source:** [src/main/services/copilot-adapter.js](../src/main/services/copilot-adapter.js)

## Overview

This module wraps the `@github/copilot-sdk` to provide:

- Alt text generation using vision models
- Folder organization suggestions
- Model listing and status checking
- Custom CLI server support

---

## Initialization

### initCopilot()

Initializes the Copilot client. Called automatically by other functions if not already initialized.

```javascript
import { initCopilot } from './services/copilot-adapter.js'

await initCopilot()
```

**Returns:** `Promise<void>`

**Behavior:**
- Creates a `CopilotClient` instance
- Connects to CLI server (default or custom URL)
- Starts the client

---

### stopCopilot()

Stops the Copilot client.

```javascript
await stopCopilot()
```

**Returns:** `Promise<void>`

---

## Configuration

### setCliServerUrl(url)

Configures the Copilot client to connect to an external CLI server.

```javascript
import { setCliServerUrl } from './services/copilot-adapter.js'

// Use custom server
setCliServerUrl('localhost:4321')

// Reset to default (auto-managed CLI)
setCliServerUrl(null)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `url` | `string \| null` | CLI server URL or null for default |

**Note:** Setting a new URL forces re-initialization on next API call.

---

### getCliServerUrl()

Gets the current CLI server URL configuration.

```javascript
const url = getCliServerUrl()
// 'localhost:4321' or null
```

**Returns:** `string | null`

---

## Status & Authentication

### checkCopilotStatus()

Checks if Copilot CLI is running and gets status info.

```javascript
const status = await checkCopilotStatus()

if (status.running) {
  console.log(`Version: ${status.version}`)
} else {
  console.error(`Error: ${status.error}`)
}
```

**Returns:**

```typescript
Promise<{
  running: boolean
  version?: string
  protocolVersion?: number
  error?: string
}>
```

---

### checkCopilotAuth()

Checks if Copilot CLI is authenticated.

```javascript
const auth = await checkCopilotAuth()

if (auth.authenticated) {
  console.log(`Logged in as: ${auth.login}`)
} else {
  console.error(`Auth failed: ${auth.error}`)
}
```

**Returns:**

```typescript
Promise<{
  authenticated: boolean
  authType?: string
  login?: string
  host?: string
  statusMessage?: string
  error?: string
}>
```

---

## Model Management

### listModels(options)

Lists available Copilot models.

```javascript
// All models
const models = await listModels()

// Vision-capable only
const visionModels = await listModels({ visionOnly: true })

models.forEach(m => {
  console.log(`${m.id}: ${m.name} (vision: ${m.supportsVision})`)
})
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `options.visionOnly` | `boolean` | `false` | Only return vision-capable models |

**Returns:**

```typescript
Promise<Array<{
  id: string
  name: string
  supportsVision: boolean
}>>
```

**Fallback Models:**

If listing fails, returns default vision-capable models:

- `gpt-4o` — GPT-4o
- `gpt-4o-mini` — GPT-4o Mini
- `claude-sonnet-4` — Claude Sonnet 4

---

## Alt Text Generation

### generateAltText(imagePath, options)

Generates alt text for an image using vision capabilities.

```javascript
const result = await generateAltText('/path/to/image.jpg', {
  maxLength: 125,
  model: 'gpt-4o'
})

if (result.valid) {
  console.log(result.altText)
} else {
  console.warn('Issues:', result.issues)
}
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `imagePath` | `string` | — | Local file path to image |
| `options.maxLength` | `number` | `125` | Maximum alt text length |
| `options.model` | `string` | `'gpt-4o'` | Model ID to use |

**Returns:**

```typescript
Promise<{
  altText: string
  valid: boolean
  issues: string[]
  raw: string
}>
```

**System Prompt Rules:**

The AI is instructed to:
- Output only valid JSON: `{"alt_text":"..."}`
- Focus on subject, action, context, important details
- NOT start with "Image of", "Photo of", etc.
- NOT include AI mentions, filenames, or SEO keywords
- Return empty alt for decorative images

---

## Folder Suggestions

### generateAltTextWithFolder(imagePath, existingFolders, options)

Analyzes an image and suggests the best folder for organization.

```javascript
const folders = await vmfClient.listFolders()
const flatFolders = flattenTree(folders)

const result = await generateAltTextWithFolder('/path/to/image.jpg', flatFolders, {
  languageName: 'English',
  metadata: {
    filename: 'product-shot.jpg',
    title: 'New Product Launch'
  },
  model: 'gpt-4o'
})

switch (result.action) {
  case 'existing':
    console.log(`Assign to folder ${result.folderId}: ${result.folderPath}`)
    break
  case 'new':
    console.log(`Create folder: ${result.newFolderPath}`)
    break
  case 'skip':
    console.log('Skip: uncategorizable')
    break
}
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `imagePath` | `string` | — | Local file path to image |
| `existingFolders` | `VmfFolder[]` | `[]` | Available folders for assignment |
| `options.languageName` | `string` | `'English'` | Language for folder names/explanations |
| `options.metadata` | `object` | `{}` | Image metadata (filename, title, alt, caption) |
| `options.model` | `string` | `'gpt-4o'` | Model ID to use |
| `options.maxLength` | `number` | `125` | Max alt text length |

**Returns:**

```typescript
Promise<{
  altText: string
  visualDescription: string
  action: 'existing' | 'new' | 'skip'
  folderId: number | null
  folderPath: string
  newFolderPath: string
  confidence: number
  reason: string
  valid: boolean
  issues: string[]
  raw: string
}>
```

**Folder Consistency Rules:**

The AI is instructed to:
- Avoid synonyms (use "Photos" not "Photographs" if "Photos" exists)
- Check for subsets (use "Nature/Mountains" not just "Mountains")
- Never suggest a folder that already exists
- Track session-suggested folders to prevent duplicates

---

## Session Management

### clearSessionSuggestedFolders()

Clears the set of folders suggested during the current session.

```javascript
// Start of new batch
clearSessionSuggestedFolders()
```

**Use Case:** Call at the start of a new folder suggestion batch to reset duplicate tracking.

---

### getSessionSuggestedFolders()

Gets the list of folders suggested during the current session.

```javascript
const suggested = getSessionSuggestedFolders()
// ['Products/New', 'Events/2024']
```

**Returns:** `string[]` — Folder paths suggested in this session

---

## Error Handling

```javascript
try {
  const result = await generateAltText(imagePath)
} catch (err) {
  if (err.message.includes('No response from Copilot')) {
    console.error('Check that Copilot CLI is installed and authenticated')
  } else if (err.message.includes('Invalid JSON')) {
    console.error('AI response parsing failed')
  } else {
    console.error('Copilot error:', err.message)
  }
}
```

**Common Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| No response from Copilot | CLI not running or not authenticated | Run `gh auth login` |
| Empty response | Model didn't return content | Retry or check image |
| Invalid JSON | Response parsing failed | Check raw response |
| No JSON found | AI didn't follow format | Retry with different model |

---

## Internal Helpers

### parseJsonResponse(text)

Extracts and parses JSON from Copilot response.

**Behavior:**
1. Removes markdown code blocks if present
2. Finds JSON object in text
3. Attempts JSON.parse
4. Recovers from truncated JSON by adding missing braces

---

### getFolderSystemPrompt(languageName)

Generates the system prompt for folder organization.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `languageName` | `string` | Language for responses |

**Returns:** `string` — Complete system prompt

---

### buildFolderUserPrompt(metadata, existingFolders, sessionSuggested)

Builds the user prompt with image metadata and folder context.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `metadata` | `object` | Image metadata |
| `existingFolders` | `VmfFolder[]` | Available folders |
| `sessionSuggested` | `Set<string>` | Already suggested folder paths |

**Returns:** `string` — User prompt for folder analysis
