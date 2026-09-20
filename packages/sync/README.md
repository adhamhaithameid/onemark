# @onemark/sync

Opt-in document sync to storage the user **already owns** — no first-party
server, no accounts, no telemetry (ADR-0018, which amends the PRD §3.1
non-goal by explicit author decision).

v1 ships:

- **The sync engine** — name-keyed two-way sync with a baseline-aware
  conflict model: last-write-wins, the losing side preserved as an automatic
  conflict copy (`README.conflict-<ts>.md`) on **both** sides. Deletions are
  never propagated in v1.
- **The WebDAV adapter** — covers "a server": Nextcloud, self-hosted DAV,
  any RFC 4918 implementation. Basic or bearer auth, `If-Match` concurrency,
  regex-minimal PROPFIND parsing (zero dependencies).
- **The URL guard** — `assertSafeRemoteUrl` refuses every private/reserved
  host (loopback, LAN ranges, CGNAT, link-local cloud metadata, IPv6
  link/unique-local/multicast, reserved names, embedded credentials,
  non-http schemes). Pure parsing; exhaustively tested.

The Google Drive and OneDrive adapters are typed (`src/types.ts`) and
specified, but land after **OAuth client registration** (an author task):
Google requires a Cloud Console OAuth client (Drive API scope
`https://www.googleapis.com/auth/drive.file`), Microsoft an Entra app
registration (`Files.ReadWrite`). Both flows use OAuth + PKCE; tokens stay in
memory for the session and are never persisted by this package.

## Usage

```js
import { createSyncEngine, createWebdavProvider } from '@onemark/sync';

const provider = createWebdavProvider('https://dav.example.com/dav/', {
  username: 'me',
  password: secretFromSessionStore(),
});
const engine = createSyncEngine(provider, localAdapter);

const report = await engine.syncOnce('/onemark/', { lastSynced });
// report: { plan, pulled, pushed, conflicts, untouched, lastSynced, conflictCopies }
// persist report.lastSynced for the next run (e.g. alongside the OPFS store)
```

`lastSynced` is the sync baseline: a `Map<name, remoteMtime>` from the
previous run. Without it, first-sight documents resolve newer-wins outright
(documented limitation — no baseline means a same-name both-changed is
undetectable).

## Security posture

- Remote URLs validated before any request (SSRF ladder closed).
- Credentials are header-borne only; URL-embedded credentials are refused.
- Tokens live in memory; never logged, never persisted by this package.
- All fetches injectable (`fetchImpl`) — the suite runs fully offline, and
  the app can attach auth at a single seam.
- Conflict copies guarantee no byte is destroyed by a sync decision.

## Tests

`pnpm --filter @onemark/sync test` — 58 tests: the URL guard table (dangerous
targets, edge acceptances), the four sync states plus conflicts/dry-run/
baselines, and WebDAV request shapes against a mock fetch.
