# Testing Guide

WP FotoKopilot uses Vitest for testing with a focus on unit and integration tests.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx vitest run tests/unit/validation.test.js

# Run with coverage
npx vitest run --coverage
```

## Test Structure

```
tests/
├── unit/                  # Unit tests for services
│   ├── validation.test.js # Alt text validation
│   ├── wp-client.test.js  # WordPress client
│   ├── vmf-client.test.js # VMF client
│   └── job-queue.test.js  # Job queue logic
├── integration/           # Integration tests
│   └── scan-workflow.test.js
└── mocks/                 # Shared test utilities
    ├── wp-server.js       # Mock WordPress server
    └── copilot-mock.js    # Mock Copilot SDK
```

## Writing Tests

### Unit Test Example

```javascript
import { describe, it, expect } from 'vitest'
import { validateAltText } from '../../src/main/utils/validation.js'

describe('validateAltText', () => {
  it('returns valid for good alt text', () => {
    const result = validateAltText('A cat sitting on a windowsill')
    
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('rejects forbidden prefixes', () => {
    const result = validateAltText('Image of a cat')
    
    expect(result.valid).toBe(false)
    expect(result.issues).toContain(
      expect.stringContaining('forbidden prefix')
    )
  })

  it('rejects text exceeding max length', () => {
    const longText = 'A'.repeat(150)
    const result = validateAltText(longText, 125)
    
    expect(result.valid).toBe(false)
    expect(result.issues).toContain(
      expect.stringContaining('Exceeds 125 characters')
    )
  })
})
```

### Testing Async Code

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWpClient } from '../../src/main/services/wp-client.js'

describe('WpClient', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  it('tests connection successfully', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        name: 'Test Site',
        url: 'https://example.com',
        language: 'en_US'
      }),
      headers: new Map()
    })

    const client = createWpClient({
      url: 'https://example.com',
      username: 'admin',
      password: 'test'
    })

    const info = await client.testConnection()
    
    expect(info.name).toBe('Test Site')
    expect(info.capabilities.rest).toBe(true)
  })

  it('handles authentication errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401
    })

    const client = createWpClient({
      url: 'https://example.com',
      username: 'admin',
      password: 'wrong'
    })

    await expect(client.testConnection()).rejects.toThrow('Unauthorized')
  })
})
```

### Testing the Job Queue

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JobQueue } from '../../src/main/services/job-queue.js'

describe('JobQueue', () => {
  let queue

  beforeEach(() => {
    queue = new JobQueue({ concurrency: 2, maxRetries: 2 })
  })

  it('processes items concurrently', async () => {
    const handler = vi.fn().mockResolvedValue({ success: true })
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
    
    const job = queue.createJob('test-job', items, handler)
    await queue.start('test-job')
    
    expect(handler).toHaveBeenCalledTimes(3)
    expect(job.status).toBe('completed')
    expect(job.completed).toBe(3)
  })

  it('retries failed items with backoff', async () => {
    let attempts = 0
    const handler = vi.fn().mockImplementation(async () => {
      attempts++
      if (attempts < 3) {
        throw new Error('Temporary failure')
      }
      return { success: true }
    })

    queue.createJob('retry-job', [{ id: 1 }], handler)
    await queue.start('retry-job')

    // Should succeed after retries
    expect(handler).toHaveBeenCalledTimes(3)
  })

  it('emits progress events', async () => {
    const progressHandler = vi.fn()
    queue.on('job:progress', progressHandler)

    const handler = vi.fn().mockResolvedValue({})
    queue.createJob('progress-job', [{ id: 1 }, { id: 2 }], handler)
    await queue.start('progress-job')

    // Should have emitted multiple progress events
    expect(progressHandler).toHaveBeenCalled()
    
    const lastCall = progressHandler.mock.calls.at(-1)[0]
    expect(lastCall.completed).toBe(2)
  })
})
```

### Integration Test Example

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupMockServer } from '../mocks/wp-server.js'

describe('Scan Workflow', () => {
  let server

  beforeAll(async () => {
    server = await setupMockServer()
  })

  afterAll(() => {
    server.close()
  })

  it('scans media and filters by missing alt', async () => {
    const client = createWpClient({
      url: `http://localhost:${server.port}`,
      username: 'test',
      password: 'test'
    })

    const items = []
    for await (const item of client.scanMedia({ missingAltOnly: true })) {
      items.push(item)
    }

    // Mock server returns 5 items, 3 without alt
    expect(items).toHaveLength(3)
    expect(items.every(i => !i.currentAlt)).toBe(true)
  })
})
```

## Mocking

### Mock WordPress Server

```javascript
// tests/mocks/wp-server.js
import { createServer } from 'node:http'

export function setupMockServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      // Parse URL and handle routes
      if (req.url === '/wp-json/') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          name: 'Mock Site',
          url: 'http://localhost',
          language: 'en_US'
        }))
      } else if (req.url.startsWith('/wp-json/wp/v2/media')) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-WP-Total': '5',
          'X-WP-TotalPages': '1'
        })
        res.end(JSON.stringify(mockMediaItems))
      }
    })

    server.listen(0, () => {
      resolve({ port: server.address().port, close: () => server.close() })
    })
  })
}
```

### Mock Copilot SDK

```javascript
// tests/mocks/copilot-mock.js
import { vi } from 'vitest'

export function mockCopilotClient() {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({ version: '1.0.0' }),
    getAuthStatus: vi.fn().mockResolvedValue({ isAuthenticated: true }),
    listModels: vi.fn().mockResolvedValue([
      { id: 'gpt-4o', capabilities: { supports: { vision: true } } }
    ]),
    createSession: vi.fn().mockReturnValue({
      send: vi.fn(),
      on: vi.fn((callback) => {
        // Simulate response
        callback({
          type: 'assistant.message',
          data: { content: '{"alt_text":"A test image"}' }
        })
      }),
      close: vi.fn()
    })
  }
}
```

## Test Configuration

### vitest.config.js

```javascript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/main/**/*.js'],
    },
  },
})
```

## CI Integration

Tests run automatically on GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
```

## Best Practices

1. **Test behavior, not implementation** - Focus on inputs/outputs
2. **Use descriptive test names** - "should reject text with forbidden prefix"
3. **Keep tests isolated** - Reset state in beforeEach
4. **Mock external dependencies** - Fetch, file system, Copilot SDK
5. **Test error cases** - Invalid input, network failures, auth errors
6. **Use async/await** - Avoid callback hell in async tests
7. **Group related tests** - Use describe() for logical grouping
