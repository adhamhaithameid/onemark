/**
 * StorageProvider — one of the two interfaces that carry the architecture
 * (tech spec §4, ADR-0007).
 *
 * Scope per the OQ-5 resolution (PRD §12): a **recent-files store**. The UI
 * branches on `capabilities`, never on platform; web gets OPFS, desktop gets
 * folders, both behind this identical surface.
 */

export interface DocumentRef {
  /** Stable identifier within the provider. */
  id: string;
  name: string;
  /** Display path; not necessarily a real filesystem path (OPFS has none). */
  path: string;
  size: number;
  /** Epoch milliseconds of last write. */
  modifiedAt: number;
}

export interface StorageProvider {
  readonly id: 'memory' | 'opfs' | 'folder';
  readonly capabilities: {
    /** false on web — Safari has no File System Access API (ADR-0007) */
    canOpenFolder: boolean;
    canWrite: boolean;
    canWatch: boolean;
  };

  /** All documents, newest first. */
  list(): Promise<DocumentRef[]>;
  /** Full content of a document. Rejects for an unknown ref. */
  read(ref: DocumentRef): Promise<string>;
  /**
   * Creates or overwrites a document by name (upsert — recent-files store,
   * OQ-5). Resolves with the (possibly new) ref and the stored content.
   */
  put(input: { name: string; content: string }): Promise<{ ref: DocumentRef }>;
  remove(ref: DocumentRef): Promise<void>;
}
