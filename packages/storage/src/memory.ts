import type { DocumentRef, StorageProvider } from './types.js';

/**
 * In-memory provider: the reference semantics for the contract suite and a
 * test double everywhere else. Nothing here is persistent by design.
 */
export class MemoryStorage implements StorageProvider {
  readonly id = 'memory' as const;
  readonly capabilities = { canOpenFolder: false, canWrite: true, canWatch: false } as const;

  private files = new Map<string, { content: string; modifiedAt: number }>();

  async list(): Promise<DocumentRef[]> {
    return [...this.files.entries()]
      .map(([id, file]) => this.refFor(id, file))
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  async read(ref: DocumentRef): Promise<string> {
    const file = this.files.get(ref.id);
    if (!file) throw new Error(`unknown document: ${ref.id}`);
    return file.content;
  }

  async put(input: { name: string; content: string }): Promise<{ ref: DocumentRef }> {
    const id = input.name;
    const existing = this.files.get(id);
    const modifiedAt = Math.max(Date.now(), (existing?.modifiedAt ?? 0) + 1);
    this.files.set(id, { content: input.content, modifiedAt });
    return { ref: this.refFor(id, this.files.get(id) as { content: string; modifiedAt: number }) };
  }

  async remove(ref: DocumentRef): Promise<void> {
    this.files.delete(ref.id);
  }

  private refFor(id: string, file: { content: string; modifiedAt: number }): DocumentRef {
    return { id, name: id, path: id, size: file.content.length, modifiedAt: file.modifiedAt };
  }
}
