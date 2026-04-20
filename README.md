# KitOps Desktop

A desktop GUI for [KitOps](https://kitops.org) — browse, pack, and manage ModelKits on macOS, Windows, and Linux.

## What is this?

KitOps Desktop gives you a visual interface for the KitOps CLI. Instead of working with ModelKits purely on the command line, you get a native app to:

- Browse all local ModelKits with size, tags, and digest info
- Inspect manifests and Kitfiles
- Pack new ModelKits from a visual Kitfile editor
- Push and pull ModelKits to/from Jozu Hub or any compatible registry
- Compare two ModelKits side by side
- Check disk usage across repositories
- Manage registry credentials securely (stored using OS keychain)

The app bundles or downloads the `kit` CLI automatically — no separate installation required.

## Download

Grab the latest release for your platform from the [Releases](../../releases) page:

| Platform | Download |
|----------|----------|
| macOS | `.dmg` |
| Windows | `.exe` installer |
| Linux | `.AppImage` or `.deb` |

## Building from source

### Prerequisites

- [Node.js](https://nodejs.org) 23+
- [pnpm](https://pnpm.io) 10+

### Setup

```bash
# Clone the repo
git clone https://github.com/kitops-ml/kitops-desktop.git
cd kitops-desktop

# Install dependencies
pnpm install

# Start in development mode
pnpm run electron:dev
```

### Building for distribution

```bash
# Build for your current platform
pnpm run electron:build
```

Output will be in `dist-electron/`. See [DEVELOPMENT.md](DEVELOPMENT.md) for more details.

## Uninstalling

To fully remove KitOps Desktop:

1. **Remove app data and ModelKits** — open the app, go to **Settings → Danger Zone** and use the removal options there. The app will quit automatically after cleanup.

2. **Delete the application** — move `KitOps Desktop.app` (macOS) or the installed program (Windows/Linux) to the trash.

3. **Remove the CLI symlink** (macOS/Linux, if you installed the command line tool):
   ```sh
   sudo rm /usr/local/bin/kit
   ```

4. **Clean up your shell profile** (macOS/Linux) — remove the block added by KitOps Desktop from `~/.zshrc` or `~/.bashrc`:
   ```sh
   # KitOps (added by KitOps Desktop)
   export KITOPS_HOME="..."
   export PATH="...:$PATH"
   ```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE)
