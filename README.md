# Desktop Prompter

A Tauri v2 desktop application for prompt engineering, terminal management, and AI-assisted development.

## Features

- **Prompt Editor**: Create and manage prompt templates with variable substitution
- **Terminal Integration**: Built-in terminal with PTY support for command execution
- **AI Assistant**: Integrated chat with Google Gemini for development assistance
- **Panel Management**: Flexible panel system for organizing your workspace
- **Auto-Update**: Automatic update checking and installation
- **Cross-Platform**: Built with Tauri for native performance (currently macOS)

## Installation

### macOS

Download the latest release from the [Releases page](https://github.com/developermarshak/desktop-prompter/releases):

1. Choose the appropriate DMG for your Mac:
   - **Apple Silicon (M1/M2/M3)**: Download `desktop-prompter_X.X.X_aarch64-apple-darwin.dmg`
   - **Intel**: Download `desktop-prompter_X.X.X_x86_64-apple-darwin.dmg`

2. Open the DMG file

3. Drag the Desktop Prompter app to your Applications folder

4. On first launch, right-click the app and select "Open" to bypass Gatekeeper

### Auto-Updates

Desktop Prompter automatically checks for updates when launched. When a new version is available:
- You'll see a notification dialog with the new version number
- Click "Update Now" to download and install
- The app will automatically relaunch with the new version

You can also manually check for updates from the app menu.

## Development

### Prerequisites

- **Node.js** 18 or higher
- **Rust** 1.70 or higher
- **Platform-specific dependencies**:
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Windows: Visual Studio Build Tools
  - Linux: webkit2gtk, libappindicator3

### Setup

```bash
# Clone the repository
git clone https://github.com/developermarshak/desktop-prompter.git
cd desktop-prompter

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run tauri build
```

### MCP Task Server

- Dev server: `npm run mcp:task-server`
- Bundled binary for production: `npm run mcp:task-server:bundle` (runs automatically before `tauri build`)

### Project Structure

```
desktop-prompter/
├── src/                    # React/TypeScript frontend
│   ├── components/         # React components
│   ├── contexts/           # React contexts
│   ├── services/           # API services
│   └── utils/              # Utility functions
├── src-tauri/              # Rust backend
│   ├── src/                # Rust source code
│   ├── icons/              # App icons
│   └── tauri.conf.json     # Tauri configuration
├── scripts/                # Build and release scripts
└── .github/workflows/      # GitHub Actions CI/CD
```

## Release Process

This project uses automated release management with GitHub Actions.

### Creating a Release

```bash
# 1. Bump version (updates package.json, Cargo.toml, tauri.conf.json)
npm run release 0.2.0

# 2. Push tags (triggers GitHub Actions workflow)
git push && git push --tags
```

The GitHub Actions workflow will automatically:
- Build DMG installers for macOS (Apple Silicon + Intel)
- Create a GitHub release with release notes
- Upload build artifacts
- Generate `latest.json` for auto-updates

### Manual Version Bump

If you only want to update version numbers without creating a release:

```bash
npm run release:prepare 0.2.0
```

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Rust, Tauri v2
- **Terminal**: portable-pty for cross-platform PTY support
- **AI Integration**: Google Gemini API
- **UI Components**: lucide-react icons, react-markdown, react-resizable-panels
- **Terminal UI**: xterm.js

## Configuration

### API Keys

To use the AI assistant, you'll need a Google Gemini API key:

1. Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Configure it in the app's settings panel

### Settings

All settings are stored locally using Tauri's built-in storage. Settings include:
- API keys
- Terminal preferences
- Panel layouts
- Prompt templates

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License

## Acknowledgments

- Built with [Tauri](https://tauri.app/)
- Terminal powered by [portable-pty](https://github.com/wez/wezterm/tree/main/pty)
- AI integration via [Google Gemini](https://ai.google.dev/)

## Support

For issues, questions, or suggestions:
- Open an issue on [GitHub](https://github.com/developermarshak/desktop-prompter/issues)
