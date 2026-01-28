# WP FotoKopilot

> I did this as a PoC, testing [GitHub Copilot SDK](https://github.com/github/copilot-sdk). Developer guide is available: [WP FotoKopilot Developer Documentation](https://github.com/soderlind/wp-fotokopilot/tree/main/docs#wp-fotokopilot-developer-documentation).

A cross-platform Electron desktop app that connects to WordPress sites via the REST API, scans the media library, and generates missing (or improved) alt text using the GitHub Copilot SDK. Optionally organizes media into Virtual Media Folders (VMF).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/electron-40.x-47848F.svg)
![React](https://img.shields.io/badge/react-19.x-61DAFB.svg)


![wp-fotokopilot-some](https://github.com/user-attachments/assets/3379660d-24d0-4603-82df-524253c1d429)

## Features

- 🔗 **Connect** to any WordPress site with REST API enabled
- 🔍 **Scan** media library with filters (missing alt text only, limit)
- 🤖 **Generate** alt text using GitHub Copilot with vision capabilities
- ✏️ **Review** and edit suggestions before applying
- 📁 **Organize** media into Virtual Media Folders (VMF plugin)
  - Install VMF plugin directly from the app (single-site WordPress)
  - Scan uncategorized media or reorganize all media
  - AI-powered folder suggestions (existing or new folders)
- 🌍 **Multi-language** prompts based on WordPress site language
- 🔒 **Secure** credential storage using OS keychain (via Electron safeStorage)
- 📊 **Export** changes to CSV or JSON

## Requirements

- Node.js 20+
- GitHub Copilot subscription (for AI features)
- WordPress site with:
  - REST API enabled
  - Application password for authentication
  - (Optional) [Virtual Media Folders](https://developer.flavflavor.dev/virtual-media-folders/) plugin for folder organization

## Installing Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/soderlind/wp-fotokopilot/releases) page:

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `WP-FotoKopilot-x.x.x-arm64.dmg` |
| macOS (Intel) | `WP-FotoKopilot-x.x.x-x64.dmg` |
| Windows | `WP-FotoKopilot-x.x.x-Setup.exe` |
| Linux (AppImage) | `WP-FotoKopilot-x.x.x.AppImage` |
| Linux (deb) | `wp-fotokopilot_x.x.x_amd64.deb` |

### macOS

1. Download the `.dmg` file for your architecture
2. Open the DMG and drag **WP FotoKopilot** to your Applications folder
3. On first launch, right-click and select "Open" to bypass Gatekeeper

### Windows

1. Download the `.exe` installer
2. Run the installer and follow the prompts
3. Launch from Start menu or desktop shortcut

### Linux

**AppImage:**
```bash
chmod +x WP-FotoKopilot-*.AppImage
./WP-FotoKopilot-*.AppImage
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i wp-fotokopilot_*_amd64.deb
```

## Building from Source

```bash
# Clone the repository
git clone https://github.com/soderlind/wp-fotokopilot.git
cd wp-fotokopilot

# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build distributables
npm run electron:build
```

## Usage

### 1. Connect to WordPress

1. Open the app and go to the **Connect** tab
2. Enter your WordPress site URL (e.g., `https://example.com`)
3. Enter your WordPress username
4. Create an [Application Password](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/) and enter it
5. Click **Test Connection** to verify
6. Click **Save & Connect**

### 2. Scan Media Library

1. Go to the **Scan** tab
2. Select options:
   - **Missing alt text only**: Only scan images without alt text
   - **Limit**: Maximum number of images to scan
3. Click **Start Scan**

### 3. Generate Alt Text

1. Go to the **Review & Apply** tab
2. Select images to process
3. Click **Generate Alt Text**
4. Review the AI-generated suggestions
5. Edit any suggestions as needed
6. Click **Apply Selected** to save changes to WordPress

### 4. Organize into Folders (Optional)

Requires the [Virtual Media Folders](https://developer.flavvor.dev/virtual-media-folders/) plugin.

1. Go to the **Folders** tab
2. View existing folder structure
3. Use AI suggestions to organize media into folders
4. Apply folder assignments

## Development

```bash
# Run development server (Vite + Electron)
npm run electron:dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build

# Build Electron distributables
npm run electron:build

# Lint code
npm run lint
```

## Project Structure

```
wp-fotokopilot/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.js          # App entry point
│   │   ├── ipc/              # IPC handlers
│   │   │   ├── router.js
│   │   │   ├── site.handlers.js
│   │   │   ├── scan.handlers.js
│   │   │   ├── job.handlers.js
│   │   │   ├── vmf.handlers.js
│   │   │   └── settings.handlers.js
│   │   ├── services/         # Core services
│   │   │   ├── wp-client.js
│   │   │   ├── vmf-client.js
│   │   │   ├── copilot-adapter.js
│   │   │   ├── job-queue.js
│   │   │   ├── thumbnail-cache.js
│   │   │   ├── credential-store.js
│   │   │   └── settings-store.js
│   │   └── utils/
│   │       └── validation.js
│   ├── preload/              # Electron preload scripts
│   │   └── index.cjs
│   └── renderer/             # React frontend
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       └── styles/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── mocks/
├── package.json
├── vite.config.js
└── vitest.config.js
```

## Configuration

Settings are stored locally and can be configured in the **Settings** tab:

| Setting | Default | Description |
|---------|---------|-------------|
| Max Alt Length | 125 | Maximum characters for generated alt text |
| Concurrency | 3 | Number of parallel AI requests |
| Export Format | CSV | Default export format (CSV or JSON) |
| Model | gpt-4o | Copilot model for alt text generation |

## Security

- Credentials are encrypted using Electron's `safeStorage` API (OS keychain)
- All network requests use HTTPS
- Renderer process is sandboxed with `contextIsolation: true`
- No `nodeIntegration` in renderer

## Tech Stack

- **Electron 40** - Desktop framework
- **React 19** - UI framework
- **Vite 7** - Build tool
- **Zustand** - State management
- **GitHub Copilot SDK** - AI integration
- **Vitest** - Testing framework
- **MSW** - API mocking for tests

## License

MIT © Per Soderlind

## Related Projects

- [vmfa-ai-organizer](https://github.com/soderlind/vmfa-ai-organizer) - WordPress plugin for AI-powered media folder organization
- [Virtual Media Folders](https://developer.flavvor.dev/virtual-media-folders/) - WordPress plugin for virtual folder organization
