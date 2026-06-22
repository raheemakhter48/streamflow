# Stream Vault Desktop

This desktop build uses the same React/Tailwind UI as the web app and wraps it in Electron.

## Requirements

- Backend API running on `http://localhost:7860`
- VLC installed if you want the `Open in VLC` action to work

## Run From Source

```bash
npm run desktop
```

## Portable Windows App

The portable app folder is generated at:

```text
release/StreamVaultPortable
```

Run:

```text
release/StreamVaultPortable/Stream Vault.exe
```

The desktop build reads API requests from `http://localhost:7860/api` by default.
