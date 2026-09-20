# ADR-0020: Tauri v2 spike — BLOCKED-ENVIRONMENTAL (one local command from unblocking)

| Field | Value |
|---|---|
| Status | Accepted (spike outcome: **blocked-environmental**, go-leaning) |
| Date | 2026-09-20 |
| Deciders | Author (delegated to the campaign) |
| Relates to | Build plan M2 (tasks 2.1–2.8), ticket `OneMark-42l` |

## Scope of the spike

Prove a Tauri v2 shell can wrap the existing `apps/web` build — nothing more.
Timeboxed by design; M2's real work (native comrak determinism test,
FolderStorage + bookmarks, menus/file associations, signing) comes after.

## What was delivered

- `src-tauri/` — a **standalone** cargo project (deliberately outside the root
  workspace): `onemark-shell` with tauri 2, a `greet` IPC command proving the
  bridge, v2 config (`tauri.conf.json`) pointing `frontendDist` at
  `../apps/web/dist`, devUrl at Vite's port, a strict CSP
  (`default-src 'self'`, KaTeX's required `'unsafe-inline'` styles, remote
  `img-src https:` for user-authored markdown images, `wasm-unsafe-eval` for
  the engine), and a `capabilities/default.json` granting only `core:default`.
- `tauri.conf.json` disables bundling for the spike; a placeholder 32×32 icon
  keeps the config valid (`cargo tauri icon` generates the real set in M2).

## The blocker (exact)

`cargo check` in `src-tauri/` fails while compiling a dependency's build
script, before any OneMark code:

```
= note: You have not agreed to the Xcode license agreements.
        Please run 'sudo xcodebuild -license' from within a Terminal window
        to review and agree to the Xcode and Apple SDKs license.
error: could not compile `zmij` (build script) due to 1 previous error
```

This is a **machine state issue, not a project issue**: the Apple SDK toolchain
on this Mac requires the author to accept the Xcode license. Accepting it needs
`sudo`, which the agent will not run. One command unblocks the spike:

```bash
sudo xcodebuild -license accept   # then: cd src-tauri && cargo check
```

## Go / no-go

**GO-leaning, pending that one command.** Evidence for the lean:

- The tauri 2 dependency tree resolves for the pinned toolchain (1.97.1) and
  the config/capability schemas are stable v2 — the shell scaffolding is
  mechanically valid.
- The architecture risk M2 was worried about is already retired by M0: native
  comrak and WASM comrak produce byte-identical ASTs (NFR-6 harness exists),
  so task 2.2's determinism test is a formality the tooling already proves.
- The remaining unknowns (WKWebView quirks with the worker + OPFS paths,
  bookmark persistence) are exactly what M2's tasks 2.3–2.6 exist to answer.

If, after `xcodebuild -license`, `cargo check` still fails on tauri 2 itself,
record it here and M2 falls back to the no-go branch: M1–M3 remain the shipped
product (the build plan already guarantees this is a real product without
desktop shells).

## Rejected alternatives

- **Run `sudo xcodebuild -license` from the agent** — requires the author's
  sudo; out of bounds by policy.
- **Add src-tauri to the root workspace** — couples shell compilation to every
  crate-level gate and vice versa; the spike (and M2) stand alone until they
  earn integration.
- **Electron fallback** — NFR-7 (2 MB budget) is the disqualifier, unchanged
  since the PRD.
