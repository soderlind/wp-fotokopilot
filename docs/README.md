# WP FotoKopilot Developer Documentation

WP FotoKopilot is an Electron desktop application for managing WordPress media with AI-powered alt text generation and folder organization.

## Table of Contents

- [Architecture Overview](./architecture.md)
- [Getting Started](./getting-started.md)
- [API Reference](./api-reference.md)
- [IPC Communication](./ipc-communication.md)
- [Testing Guide](./testing.md)
- **Tutorials** — [Full index](./tutorial/index.md)
  1. [React/Electron Hooks and Integration](./tutorial/01_react_electron_hooks_and_integration_.md)
  2. [Electron IPC & Main Process Routing](./tutorial/02_electron_ipc___main_process_routing_.md)
  3. [App Settings and State Management](./tutorial/03_app_settings_and_state_management_.md)
  4. [Secure Credential Storage](./tutorial/04_secure_credential_storage___credential_store_js___.md)
  5. [WordPress REST API Client](./tutorial/05_wordpress_rest_api_client___wp_client_js___.md)
  6. [Virtual Media Folders (VMF) Integration](./tutorial/06_virtual_media_folders__vmf__integration_.md)
  7. [Job Processing & Queue](./tutorial/07_job_processing___queue___job_queue_js___.md)
  8. [GitHub Copilot SDK Integration](./tutorial/08_github_copilot_sdk_integration___copilot_adapter_js___.md)
  9. [Thumbnail Caching](./tutorial/09_thumbnail_caching___thumbnail_cache_js___.md)
  10. [Validation Utilities](./tutorial/10_validation_utilities___validation_js___.md)

## Quick Start

```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run electron:dev

# Run tests
npm test

# Build for production
npm run electron:build
```

## Tech Stack

- **Electron 40** - Desktop app framework
- **React 19** - UI library
- **Vite 7** - Build tool with HMR
- **Zustand** - State management
- **GitHub Copilot SDK** - AI integration
- **Vitest** - Testing framework

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── index.js    # App entry point
│   ├── ipc/        # IPC handlers
│   ├── services/   # Business logic
│   └── utils/      # Utilities
├── preload/        # Context bridge
│   └── index.cjs   # Exposed APIs
└── renderer/       # React UI
    ├── App.jsx     # Root component
    ├── components/ # UI components
    ├── hooks/      # React hooks
    └── stores/     # Zustand stores
```
