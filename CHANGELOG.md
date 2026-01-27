# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-01-27

### Fixed

- Media card now shows "✓ Alt text added" instead of "No alt text" when proposed alt is set
- Fixed vmf-client tests to match new assignMedia return format

## [0.2.0] - 2026-01-27

### Added

- **Plugin Management**
  - Install and activate WordPress plugins via REST API
  - Automatic VMF plugin installation from wordpress.org
  - Plugin listing and status checking
  - Multisite-aware error handling with guidance for Network Admin

- **UX Improvements**
  - Clickable site cards in Connect tab
  - VMF capability badge on connected sites (adapts to selection state)
  - Renamed "Media" tab to "Alt Text" for clarity
  - VMF installation prompt with icon when plugin not detected
  - Improved folder suggestions with dismiss functionality
  - Assignment preview showing where images will be organized
  - Collapsible folder hierarchy view
  - Scan modes: "Uncategorized" (primary) and "All (Reorganize)"

### Fixed

- VMF API now uses correct `media_id` parameter (singular)
- Job queue progress events include full result object for folder suggestions
- Better error messages for WordPress Multisite plugin management

## [0.1.0] - 2026-01-27

### Added

- **WordPress Integration**
  - Connect to WordPress sites via REST API with Application Passwords
  - Secure credential storage using Electron safeStorage (OS keychain)
  - Automatic site language detection for multi-language support
  - Scan media library with pagination support
  - Filter by missing alt text only
  - Update alt text via REST API

- **AI-Powered Alt Text Generation**
  - Integration with GitHub Copilot SDK
  - Vision-capable model for image analysis
  - Comprehensive alt text validation rules
  - Forbidden prefix detection ("Image of", "Photo of", etc.)
  - AI mention detection
  - Configurable maximum alt text length

- **Virtual Media Folders (VMF) Support**
  - List existing VMF folder structure
  - Create new folders and nested paths
  - Assign media to folders
  - AI-powered folder suggestions based on vmfa-ai-organizer patterns
  - Folder consistency rules (avoid synonyms, check for subsets)
  - Session folder tracking to prevent duplicates

- **Job Processing**
  - Concurrent job processing with configurable parallelism
  - Automatic retry with exponential backoff (3 attempts)
  - Pause, resume, and cancel operations
  - Real-time progress updates via IPC

- **User Interface**
  - Modern React 19 UI with tabbed navigation
  - Connect tab for site management
  - Scan tab with filter options
  - Review tab for alt text approval
  - Folders tab for VMF organization
  - Settings tab for configuration
  - Media grid with thumbnail previews
  - Progress indicators

- **Export & Reporting**
  - Export changes to CSV format
  - Export changes to JSON format

- **Developer Experience**
  - Full test suite with Vitest (50 tests)
  - MSW for API mocking
  - ESLint configuration
  - Vite 7 for fast builds

### Technical Details

- Electron 40 with secure defaults (contextIsolation, sandbox)
- React 19 with functional components and hooks
- Zustand for state management
- electron-store 11 for persistent settings
- Thumbnail caching with LRU eviction (500MB limit)

### Security

- All credentials encrypted with OS keychain
- Strict IPC validation (sender URL verification)
- Sandboxed renderer process
- No nodeIntegration in renderer
- HTTPS-only for WordPress connections

[Unreleased]: https://github.com/soderlind/wp-fotokopilot/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/soderlind/wp-fotokopilot/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/soderlind/wp-fotokopilot/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yourusername/wp-fotokopilot/releases/tag/v0.1.0
