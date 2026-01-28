# WP FotoKopilot Developer Documentation

WP FotoKopilot is an Electron desktop application for managing WordPress media with AI-powered alt text generation and folder organization.

## Table of Contents

- [Architecture Overview](./architecture.md)
- [Getting Started](./getting-started.md)
- [API Reference](./api-reference.md)
- [IPC Communication](./ipc-communication.md)
- [Testing Guide](./testing.md)

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
