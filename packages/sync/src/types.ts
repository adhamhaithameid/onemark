/**
 * Sync layer types (P7, ADR-0018).
 *
 * OneMark syncs documents to storage the USER already owns — a WebDAV server,
 * Google Drive, OneDrive. There is no first-party server, no accounts, no
 * telemetry in this layer. Credentials live in memory for the session.
 *
 * The layer sits ABOVE storage (packages/storage holds the local documents);
 * a SyncProvider is the remote mirror, not a StorageProvider.
 */

/** A document as it exists on the remote. */
export interface RemoteRef {
  /** Provider-specific identifier (file id, server path). */
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly modifiedAt: number;
  readonly size: number;
  /** Opaque concurrency token where the provider has one (ETag, ctag…). */
  readonly etag?: string;
}

/**
 * Credentials, in-memory only. Nothing in this package persists them; the
 * embedding app may keep them in a session-scoped secret store if it chooses.
 */
export interface SyncCredentials {
  readonly kind: 'bearer';
  readonly accessToken: string;
  readonly refreshToken?: string;
  /** Epoch ms after which accessToken should be refreshed, if known. */
  readonly expiresAt?: number;
}

/** The remote side of a document sync. */
export interface SyncProvider {
  readonly id: 'webdav' | 'gdrive' | 'onedrive';
  readonly displayName: string;

  /**
   * OAuth authorisation start URL, where the provider uses OAuth. The app
   * opens it, the user consents, the provider redirects back with `code`.
   */
  authUrl?(): string;
  /** OAuth authorisation finish. `verifier` is the PKCE verifier used at start. */
  exchangeCode?(code: string, verifier: string): Promise<SyncCredentials>;

  /** List documents directly under a folder path/id. */
  list(folder: string): Promise<RemoteRef[]>;
  /** Read a document's content. */
  get(path: string): Promise<{ content: string; modifiedAt: number; etag?: string }>;
  /**
   * Write a document. If `ifMatchEtag` is given and the remote moved on, the
   * provider rejects (412/409) — callers treat that as a conflict, never as
   * an error to retry blindly.
   */
  put(path: string, content: string, ifMatchEtag?: string): Promise<{ modifiedAt: number; etag?: string }>;
  /** Remove a remote document (a trashing provider trashes). */
  remove(path: string): Promise<void>;
}

/** The local side, as the engine sees it (structural twin of StorageProvider). */
export interface LocalAdapter {
  list(): Promise<Array<{ id: string; name: string; modifiedAt: number }>>;
  read(id: string): Promise<string>;
  /** Upsert by name; returns the local id written. */
  put(input: { name: string; content: string }): Promise<string>;
}

export interface SyncPlanEntry {
  readonly doc: string;
  readonly action: 'pull' | 'push' | 'conflict-pull' | 'conflict-push';
  /** Set on conflict actions: the name the losing copy is preserved under. */
  readonly conflictCopyAs?: string;
}

export interface SyncReport {
  readonly pulled: number;
  readonly pushed: number;
  readonly conflicts: number;
  /** Documents only on one side are handled; deletions are never propagated (v1). */
  readonly untouched: number;
}

export interface SyncEngineOptions {
  /**
   * v1 conflict policy: last-write-wins, the loser preserved as an automatic
   * conflict copy both locally and remotely (`name.conflict-<ts>.md`).
   * Deliberately boring; no merge, no CRDT (ADR-0018 rejected alternatives).
   */
  conflictPolicy: 'lww-with-copy';
}
