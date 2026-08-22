# ADR-0009 — pnpm + cargo monorepo

**Status:** Accepted · **Date:** 2026-08-16

## Context

The project has four distinct build artifacts: a Rust engine crate, a WASM binding, a TypeScript UI, and a Tauri shell. The engine is to be treated as a **versioned internal package** — semver, changelog, breaking-change discipline — without being published.

## Decision

**A single monorepo**, with `pnpm` workspaces for TypeScript and a `cargo` workspace for Rust.

```
crates/     onemark-engine · onemark-wasm        → cargo
packages/   engine · renderer · storage · ui     → pnpm
apps/       web · desktop                        → pnpm (+ cargo for the shell)
```

## Alternatives rejected

| Option | Why rejected |
|---|---|
| npm workspaces | Flat/hoisted `node_modules` allows **phantom dependencies** — importing a package that was never declared, which works locally and breaks in CI. This is the characteristic monorepo failure mode; pnpm's strict symlinks make it fail at install time instead. pnpm is also ~2–3× faster and shares a content-addressable store across all the author's projects. |
| Single flat repo, engine as a folder | No enforced boundary. The engine interface (ADR-0002) would erode, and with it the ability to swap engines. |
| Separate repos for engine and apps | Cross-repo version bumps on every change, solo, for no benefit. |

Precedent: `Rally` already uses `pnpm-workspace.yaml`.

## Consequences

**Good:** the engine boundary is enforced by the package manager, not by discipline. One checkout, one CI, atomic cross-package changes.

**Bad / accepted cost:** **two package managers and two lockfiles** (`pnpm-lock.yaml`, `Cargo.lock`), two dependency graphs, two CI cache strategies. Normal for Tauri, but it must be expected rather than discovered.

**Reversibility:** moderate — splitting later is mechanical but tedious.
