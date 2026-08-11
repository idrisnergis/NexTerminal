# NexTerm

Open-source SSH connection manager for Windows, macOS, and Linux.

## Features

- Multi-tab SSH terminal with xterm.js
- SFTP file browser (upload, download with progress bar, rename, delete)
- Connection manager with folder grouping & drag-drop
- Password and SSH key authentication (PPK & PEM supported)
- Import/export connections as JSON
- .ini / .mxtsessions session import (PuTTY, MobaXterm)
- Local terminal (PowerShell / zsh / bash)
- Keyboard-interactive auth (password prompt in terminal)
- File date & size display in file browser
- Configurable font sizes (terminal & sidebar)
- Resizable panels (sidebar & file browser)
- Splash screen with animated logo
- Cross-platform: Windows, macOS, Linux
- Dark theme (Tokyo Night)

## Requirements

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- npm 9+
- **Windows:** No additional requirements
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Linux:** `build-essential`, `libsecret-1-dev`, `rpm` (for AppImage)

## Quick Start

```bash
# Install dependencies
npm install

# Build and launch the app
npm start
```

## Development

```bash
# Watch mode — Vite dev server + TypeScript watcher + Electron
npm run dev

# Build only (no launch)
npm run build

# Launch after build
npm start
```

## Packaging (Desktop Installers)

### Windows

```bash
npm run package:win
```

Output: `release/win-unpacked/NexTerm.exe` — portable, no installation needed. Double-click to run.

### macOS

```bash
npm run package:mac
```

Output: `release/` — DMG installer and ZIP archive.

> Note: Build on a Mac for macOS packages. Code signing and notarization require an Apple Developer account for distribution.

### Linux

```bash
npm run package:linux
```

Output: `release/` — AppImage and tar.gz.

> Note: Build on a Linux machine for Linux packages.

### Current Platform (auto-detect)

```bash
npm run package
```

Creates an unpacked directory build for the OS you're running on.

## Running on Each Platform

### Windows

1. `npm install` → `npm start` (development)
2. Or run the packaged `release/win-unpacked/NexTerm.exe`
3. Local terminal uses PowerShell by default

### macOS

1. `npm install` → `npm start` (development)
2. Or open the packaged `.app` from DMG
3. Uses native window frame with system traffic light buttons
4. Local terminal uses your default shell (zsh on macOS Catalina+)
5. Data stored in `~/Library/Application Support/NexTerm/`
6. Logs stored in `~/Library/Application Support/NexTerm/logs/`

### Linux

1. `npm install` → `npm start` (development)
2. Or run the AppImage: `chmod +x NexTerm-*.AppImage && ./NexTerm-*.AppImage`
3. Uses native window frame
4. Local terminal uses your `$SHELL` or `/bin/bash`
5. Data stored in `~/.config/NexTerm/`
6. Logs stored in `~/.config/NexTerm/logs/`

## Data & Configuration

All data is stored in the OS user data directory under `NexTerm/`:

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\NexTerm\` |
| macOS | `~/Library/Application Support/NexTerm/` |
| Linux | `~/.config/NexTerm/` |

Files:
- `connections.json` — saved SSH connections
- `settings.json` — app settings (font size, default key, etc.)
- `logs/nexterm.log` — application log (5MB max, auto-rotated)

## Import / Export Connections

- **Export:** Settings → Export → saves all connections as a `.json` file
- **Import JSON:** Settings → Import → select a previously exported `.json`
- **Import Sessions:** Settings → Import .ini/.mxtsessions (PuTTY, MobaXterm)

## NPM Scripts Reference

| Command | Description |
|---------|-------------|
| `npm start` | Build + launch Electron |
| `npm run dev` | Development mode with hot-reload |
| `npm run build` | Compile TypeScript + bundle renderer |
| `npm run package` | Package for current platform |
| `npm run package:win` | Package for Windows (unpacked dir) |
| `npm run package:mac` | Package for macOS (DMG + ZIP) |
| `npm run package:linux` | Package for Linux (AppImage + tar.gz) |

## Tech Stack

Electron · React · TypeScript · xterm.js · ssh2 · Tailwind CSS · Vite · Lucide Icons

## Troubleshooting

### Windows: `package:win` fails with "Access is denied"
Windows Defender real-time scanning can block electron-builder's cache operations. Solutions:
1. Run the terminal as Administrator
2. Add `%LOCALAPPDATA%\electron-builder\Cache` to Defender exclusions

### macOS: App is damaged / can't be opened
For unsigned builds: `xattr -cr /path/to/NexTerm.app`

### Linux: AppImage won't launch
Make it executable: `chmod +x NexTerm-*.AppImage`

### Terminal font looks wrong
Install a Nerd Font or one of: JetBrains Mono, Cascadia Code, Fira Code

## License

MIT
