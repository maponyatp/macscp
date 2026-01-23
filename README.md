# MacSCP

A high-performance, native-feeling macOS SCP/SSH client built with Electron, React, and TypeScript. Dual-pane file management meets modern aesthetics.

![MacSCP Banner](public/logo.png) <!-- Placeholder for banner -->

## Features

- **Multi-Protocol Support**: Robust support for **SFTP**, **SCP**, **FTP/FTPS**, and **Amazon S3**.
- **Dual-Pane File Management**: Seamlessly browse local and remote file systems side-by-side with modern aesthetics.
- **Advanced Authentication**: Integrated with macOS SSH Agent and Keychain. Supports SSH keys with passphrases.
- **Non-blocking Transfer Queue**: Background transfer manager with progress bars, speed metrics, and concurrent tasks.
- **Directory Synchronization**: 
    - **Compare & Sync**: Identify differences between local and remote directories.
    - **Keep Remote Up-to-Date**: Real-time watching and syncing of local changes to the server.
- **Integrated Terminal**: Built-in shell access via `xterm.js` for quick command execution.
- **Remote File Editing**: Edit files directly on your server with an integrated editor or your favorite external editor.
- **Session Management**: Save and organize multiple connection profiles with folder support and favorites.
- **Native macOS Design**: Vibrant dark mode and glassmorphism effects for a premium, high-performance feel.

## Tech Stack

- **Frontend**: React, Tailwind CSS, Lucide Icons, Sonner.
- **Backend**: Electron, Node.js.
- **Core Libraries**:
    - `ssh2`: Powering SFTP and SCP connections.
    - `basic-ftp`: For robust FTP/FTPS support.
    - `@aws-sdk/client-s3`: Native S3 integration.
    - `chokidar`: For real-time file system watching.
    - `xterm.js`: Integrated terminal emulation.
- **Developer Experience**: Vite, TypeScript, ESLint.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/tumishomaponya/macscp.git
    cd macscp
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Start development mode**:
    ```bash
    npm run dev
    ```

### Building for Production

To create a production-ready application bundle:

```bash
npm run build
```

The output will be in the `release/` directory.

## Documentation

- [Architecture Overview](ARCHITECTURE.md) - Learn how MacSCP is structured.
- [Gap Analysis](GAP_ANALYSIS.md) - Technical comparison with WinSCP and roadmap.
- [Contributing Guide](CONTRIBUTING.md) - How to get involved.
- [License](LICENSE) - MIT License.

## Roadmap

- [ ] **Auto-resume**: Persistent transfer queue with auto-resume for failed transfers.
- [ ] **Native Drag-and-Drop**: Deep integration with macOS native drag-and-drop.
- [ ] **Connection Pooling**: Performance optimizations for high-latency environments.
- [ ] **CLI Version**: Headless version of the MacSCP engine for automation.

## Credits

Developed by [Tumisho Maponya](https://github.com/tumishomaponya).

---

MacSCP is open-source and looking for contributors!
