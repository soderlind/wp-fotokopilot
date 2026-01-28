# Getting Started

## Prerequisites

- **Node.js 20+** - Required for Electron 40
- **GitHub Copilot CLI** - For AI features (`gh copilot`)
- **WordPress site** with:
  - REST API enabled
  - Application Password created
  - (Optional) Virtual Media Folders plugin for organization

## Installation

```bash
# Clone the repository
git clone https://github.com/soderlind/wp-fotokopilot.git
cd wp-fotokopilot

# Install dependencies
npm install
```

## Development

### Running in Development Mode

```bash
# Start Vite dev server + Electron with hot reload
npm run electron:dev
```

This runs:
1. Vite dev server on `http://localhost:5173`
2. Electron app that loads from the dev server
3. DevTools automatically open

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server only |
| `npm run electron:dev` | Start full Electron development |
| `npm run build` | Build renderer for production |
| `npm run electron:build` | Build distributable app |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |

## Configuration

### WordPress Site Setup

1. Create an Application Password:
   - Go to WordPress Admin → Users → Your Profile
   - Scroll to "Application Passwords"
   - Enter a name (e.g., "WP FotoKopilot")
   - Click "Add New Application Password"
   - Copy the generated password

2. In WP FotoKopilot:
   - Go to Connect tab
   - Enter your site URL
   - Enter your username
   - Paste the Application Password
   - Click Connect

### GitHub Copilot Setup

1. Install GitHub CLI: `brew install gh`
2. Authenticate: `gh auth login`
3. Install Copilot extension: `gh extension install github/gh-copilot`

The app will automatically use the Copilot CLI for AI features.

### Optional: Custom Copilot Server

For development with a custom Copilot server:

1. Go to Settings tab
2. Enter the server URL (e.g., `localhost:4321`)
3. Click Save

## Project Structure Details

### Main Process (`src/main/`)

```
main/
├── index.js              # App entry, window creation
├── ipc/
│   ├── router.js         # Registers all IPC handlers
│   ├── site.handlers.js  # Site management
│   ├── scan.handlers.js  # Media scanning
│   ├── job.handlers.js   # Job queue control
│   ├── vmf.handlers.js   # Folder operations
│   ├── settings.handlers.js
│   └── copilot.handlers.js
├── services/
│   ├── wp-client.js      # WordPress REST API
│   ├── vmf-client.js     # VMF REST API
│   ├── copilot-adapter.js # GitHub Copilot SDK
│   ├── credential-store.js # Secure storage
│   ├── settings-store.js # App settings
│   ├── job-queue.js      # Concurrent processing
│   └── thumbnail-cache.js # Image cache
└── utils/
    └── validation.js     # Alt text validation
```

### Renderer Process (`src/renderer/`)

```
renderer/
├── App.jsx               # Root component with tabs
├── main.jsx              # React entry point
├── index.html            # HTML template
├── components/
│   ├── ConnectTab.jsx    # Site connection UI
│   ├── MediaTab.jsx      # Alt text generation UI
│   ├── FoldersTab.jsx    # Folder organization UI
│   ├── SettingsTab.jsx   # Settings UI
│   ├── MediaGrid.jsx     # Media grid component
│   └── ProgressBar.jsx   # Progress indicator
├── hooks/
│   ├── useElectronAPI.js # Access to IPC API
│   ├── useJobProgress.js # Job progress subscription
│   └── useScanProgress.js # Scan progress subscription
├── stores/
│   └── appStore.js       # Zustand global state
└── styles/
    └── main.css          # Global styles
```

## Adding New Features

### Adding an IPC Handler

1. Create handler in `src/main/ipc/`:

```javascript
// example.handlers.js
export function exampleHandlers(mainWindow) {
  return [
    {
      channel: 'example:doSomething',
      async handler(arg1, arg2) {
        // Implementation
        return result
      }
    }
  ]
}
```

2. Register in `router.js`:

```javascript
import { exampleHandlers } from './example.handlers.js'

export function registerIpcHandlers(mainWindow, ipcMain) {
  const allHandlers = [
    // ...existing handlers
    ...exampleHandlers(mainWindow),
  ]
  // ...
}
```

3. Expose in preload (`src/preload/index.cjs`):

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ...existing APIs
  example: {
    doSomething: (arg1, arg2) => 
      ipcRenderer.invoke('example:doSomething', arg1, arg2),
  },
})
```

### Adding a New Service

1. Create service in `src/main/services/`:

```javascript
// my-service.js

/**
 * @fileoverview Description of the service
 * @module main/services/my-service
 */

export function createMyService(options) {
  return {
    async myMethod(param) {
      // Implementation
    }
  }
}
```

2. Use in handlers or other services
