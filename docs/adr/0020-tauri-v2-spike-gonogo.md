# ADR-0020: Tauri v2 spike — GO (compile verified)

| Field | Value |
|---|---|
| Status | Accepted (spike outcome: **GO**, `cargo check` green) |
| Date | 2026-09-20 (blocked-environmental same morning; author accepted the Xcode license, unblocking same day) |
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

## The blocker (resolved same day)

The first `cargo check` failed on machine state — the Apple SDK toolchain
required the author to accept the Xcode license (`sudo xcodebuild -license`);
the agent does not run sudo. The author accepted the license, and the check
then surfaced one real scaffold bug (a `main.rs` lib-name mismatch —
`onemark_shell_lib` vs the default `onemark_shell`), fixed and re-checked:

```
Checking onemark-shell v0.1.0 (…/src-tauri)
Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.19s
```

The full tauri 2 dependency tree compiles for the pinned toolchain (1.97.1)
against this Mac's Apple SDK.

## Go / no-go

**GO — verified.** The spike's compile gate passes, the config schema holds,
and the biggest M2 architecture risk was already retired by M0: native comrak
and WASM comrak produce byte-identical ASTs (the NFR-6 harness exists), so
task 2.2's determinism test is a formality the tooling already proves.
M2 proceeds in build-plan order; the remaining unknowns (WKWebView quirks
with the worker + OPFS paths, bookmark persistence) are exactly what tasks
2.3–2.6 exist to answer.

If a later task collapses, the standing fallback holds: M1–M3 remain the
shipped product.

## Rejected alternatives

- **Run `sudo xcodebuild -license` from the agent** — requires the author's
  sudo; out of bounds by policy (the author ran it).
- **Add src-tauri to the root workspace** — couples shell compilation to every
  crate-level gate and vice versa; the shell (and M2) stand alone until they
  earn integration.
- **Electron fallback** — NFR-7 (2 MB budget) is the disqualifier, unchanged
  since the PRD.
