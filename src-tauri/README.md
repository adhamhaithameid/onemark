# onemark-shell (M2 spike)

A standalone Tauri v2 shell wrapping the `apps/web` build. See
[ADR-0020](../docs/adr/0020-tauri-v2-spike-gonogo.md) for the spike's outcome.

## Build

The shell consumes `apps/web/dist`:

```bash
pnpm --filter @onemark/web build     # produce the frontend
cd src-tauri
PATH="$HOME/.cargo/bin:$PATH" cargo check   # spike verification
```

For a real window (M2 setup, needs the tauri CLI and an accepted Xcode license
on macOS — see ADR-0020 for the exact blocker encountered):

```bash
sudo xcodebuild -license accept       # once, author action
pnpm add -g @tauri-apps/cli           # once
cargo tauri icon src-tauri/icons/icon.png   # real icon set
cd src-tauri && cargo tauri dev
```

## What's stubbed

- **Icons** — one placeholder PNG; `cargo tauri icon` generates the platform
  set in M2.
- **IPC** — a `greet` command proving the bridge; real M2 registers a native
  `comrak` parse command behind the same `MarkdownEngine` interface.
- **Capabilities** — `core:default` only; M2 adds dialog/fs plugin permissions
  for FolderStorage and security-scoped bookmarks.
- **Bundling** — disabled in `tauri.conf.json` for the spike.
