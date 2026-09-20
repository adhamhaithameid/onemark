# ADR-0018: Opt-in sync adapters — user-owned storage, no first-party server

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-20 |
| Deciders | Author (explicit instruction: "develop a sync layer that connects to google drive, a server, one drive, and any platform that provide upload/download and syncing") |
| Amends | PRD §3.1 non-goal "Not a sync service" |

## Context

The PRD excluded sync as a scope-creep vector: no accounts, no server, no
conflict resolution. The author has explicitly directed a sync layer. The
original *reason* for the non-goal stands: sync infrastructure (accounts,
storage, uptime) is a product OneMark should not become. The non-goal is
therefore amended, not deleted: **OneMark syncs documents to storage the user
already owns; it never becomes a storage provider.**

## Decision

1. **Providers, not a backend.** `packages/sync` speaks to WebDAV (covers
   "a server": Nextcloud, self-hosted DAV), Google Drive and OneDrive. The
   Drive/OneDrive adapters are typed and specified in v1; they land after the
   author registers OAuth clients (Google Cloud Console `drive.file` scope;
   Entra app `Files.ReadWrite`) — a task that cannot be done for them.
2. **OAuth + PKCE, in-session tokens.** No refresh-token storage, no account
   system. Credentials live in memory for the session; the package never
   persists or logs them.
3. **LWW with automatic conflict copies.** Conflicts resolve last-write-wins;
   the loser is written as `name.conflict-<ts>.md` on both sides. No merge,
   no CRDT. The engine is baseline-aware (compares local mtime, remote mtime
   and the last-synced remote mtime), which is what makes "both changed"
   detectable at all.
4. **Deletions never propagate in v1.** A remote deletion may mean "moved";
   v1's contract is that sync never destroys a document the other side still
   has.
5. **SSRF guard is load-bearing.** Sync targets are user-supplied URLs.
   `assertSafeRemoteUrl` refuses loopback, private ranges, CGNAT, link-local
   (cloud metadata), IPv6 link/unique-local/multicast, reserved names,
   non-http schemes and embedded credentials, before any request.
6. **Offline-first untouched.** Sync is opt-in, off by default, and the app
   is fully functional without it (NFR-1 preserved). M2's zero-network
   render guarantee is unaffected — the render path never syncs.

## Rejected alternatives

- **First-party sync server** — recreates the exact product OneMark refuses
  to be (accounts, uptime, cost, privacy surface).
- **Git-backed sync** — OneMark is explicitly not a git client (PRD §3.1);
  merge semantics belong to the user's VCS, not a viewer/editor.
- **CRDT / operational merge** — weeks of correctness surface for a feature
  whose v1 job is "my files follow me". Conflict copies are honest and
  comprehensible; merge can come later behind the same interface.
- **Full CRDT-free three-way merge via content hashes** — same reasoning;
  deferred with the conflict-copy escape hatch in place.

## Consequences

- `packages/sync` v1 ships engine + WebDAV adapter + URL guard (58 tests,
  fully offline via injected fetch).
- The app integration (sync panel: connect, pick folder, status) is a
  follow-up task in the apps/web shell, gated on the author's OAuth
  registrations for Drive/OneDrive.
- Drive/OneDrive folder ids are provider-shaped: the engine's `folder`
  parameter is opaque, so adapters keep their own semantics (path for DAV,
  folder id for drives).
