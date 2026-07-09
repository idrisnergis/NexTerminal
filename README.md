# NexTerm

Open-source SSH connection manager for Windows, macOS, and Linux.  

## Features

- Multi-tab SSH terminal with xterm.js
- SFTP file browser (upload, download, rename, delete)
- Connection manager with folder grouping & drag-drop
- Password and SSH key authentication (PPK & PEM supported)
- .ini session import
- Local terminal (PowerShell / Bash)
- Keyboard-interactive auth (password prompt in terminal)
- Session auto-reconnect on disconnect
- Resizable panels (sidebar & file browser)
- Dark theme

## Quick Start

```bash
npm install
npm start
```

## Development

```bash
npm run dev      # Watch mode (renderer + main)
npm start        # Launch app
```

## Build

```bash
npm run build      # Production build
npm run package    # Create installer (.exe / .dmg / .AppImage)
```

## Import Sessions

Settings → Import Connections → Select your `.ini` or `.mxtsessions` file.

## Tech Stack

Electron · React · TypeScript · xterm.js · ssh2 · Tailwind CSS · Vite

## License

MIT
