/**
 * SyncEngine (P7, ADR-0018): name-keyed two-way document sync between the
 * local store and a user-owned remote.
 *
 * Correctness model — three clocks per document:
 *   local mtime, remote mtime, and the baseline (the remote mtime recorded at
 *   the last successful sync, in `lastSynced`). Comparing all three detects
 *   the four real states:
 *
 *   - baseline missing (first sight): newer side wins outright. Without a
 *     baseline a same-name both-changed is undetectable; documented.
 *   - local changed, remote unchanged since baseline → push
 *   - remote changed, local unchanged since baseline → pull
 *   - both changed since baseline → conflict: last-write-wins, the loser is
 *     preserved as an automatic conflict copy on BOTH sides
 *     (`name.conflict-<ts>.md`), so no byte is ever destroyed.
 *
 * Deletions are never propagated in v1: a remote deletion may mean "moved",
 * and the v1 contract is that sync must never destroy a document the other
 * side still has. Orphans simply exist on one side until a human intervenes.
 *
 * All fetches are injected (provider-level), so the engine is testable
 * offline; nothing here touches the network itself.
 */

/** @typedef {import('./types.js').SyncProvider} SyncProvider */
/** @typedef {import('./types.js').LocalAdapter} LocalAdapter */

/**
 * @param {SyncProvider} provider
 * @param {LocalAdapter} local
 * @param {{ conflictPolicy?: 'lww-with-copy' }} [options]
 */
export function createSyncEngine(provider, local, options = {}) {
  if (options.conflictPolicy && options.conflictPolicy !== 'lww-with-copy') {
    throw new Error('unknown conflict policy: ' + String(options.conflictPolicy));
  }

  /**
   * @param {string} folder remote folder path or id (provider-shaped)
   * @param {{ lastSynced?: Map<string, number>, now?: number }} [state]
   *   lastSynced: baseline remote mtimes from the previous run (mutated and
   *   returned updated after a successful run). now: clock override for tests.
   * @returns {Promise<{plan: Array<{doc: string, action: string, conflictCopyAs?: string}>, pulled: number, pushed: number, conflicts: number, untouched: number, lastSynced: Map<string, number>}>}
   */
  async function syncOnce(folder, state = {}) {
    const lastSynced = state.lastSynced ?? new Map();
    const now = state.now ?? Date.now();
    const dryRun = state.dryRun === true;
    const [remotes, locals] = await Promise.all([provider.list(folder), local.list()]);
    const remoteByName = new Map(remotes.map((r) => [r.name, r]));
    const localByName = new Map(locals.map((l) => [l.name, l]));

    /** @type {Array<{doc: string, action: string, conflictCopyAs?: string}>} */
    const plan = [];
    const names = new Set([...remoteByName.keys(), ...localByName.keys()]);

    for (const name of names) {
      const remote = remoteByName.get(name);
      const localDoc = localByName.get(name);
      if (remote && !localDoc) { plan.push({ doc: name, action: 'pull' }); continue; }
      if (!remote && localDoc) { plan.push({ doc: name, action: 'push' }); continue; }
      if (!remote || !localDoc) continue;

      const baseline = lastSynced.get(name);
      const localChanged = baseline === undefined || localDoc.modifiedAt !== baseline;
      const remoteChanged = baseline === undefined || remote.modifiedAt !== baseline;

      if (!localChanged && !remoteChanged) continue; // untouched
      if (baseline === undefined) {
        // First sight: the newer side wins outright (documented limitation).
        plan.push({ doc: name, action: localDoc.modifiedAt >= remote.modifiedAt ? 'push' : 'pull' });
        continue;
      }
      if (localChanged && !remoteChanged) { plan.push({ doc: name, action: 'push' }); continue; }
      if (remoteChanged && !localChanged) { plan.push({ doc: name, action: 'pull' }); continue; }

      // Both changed since the baseline → conflict. LWW by modification time;
      // the loser becomes a conflict copy on both sides.
      const localWins = localDoc.modifiedAt >= remote.modifiedAt;
      plan.push({
        doc: name,
        action: localWins ? 'conflict-push' : 'conflict-pull',
        conflictCopyAs: conflictCopyName(name, now),
      });
    }

    let pulled = 0, pushed = 0, conflicts = 0;
    const nextBaseline = new Map(lastSynced);
    const conflictCopies = [];

    if (dryRun) {
      return {
        plan,
        pulled: plan.filter((p) => p.action === 'pull').length,
        pushed: plan.filter((p) => p.action === 'push').length,
        conflicts: plan.filter((p) => p.action.startsWith('conflict')).length,
        untouched: names.size - plan.length,
        lastSynced,
        conflictCopies: [],
      };
    }

    for (const entry of plan) {
      const remote = remoteByName.get(entry.doc);
      const localDoc = localByName.get(entry.doc);
      if (entry.action === 'pull') {
        const got = await provider.get(providerPath(folder, entry.doc));
        await local.put({ name: entry.doc, content: got.content });
        nextBaseline.set(entry.doc, got.modifiedAt);
        pulled += 1;
      } else if (entry.action === 'push') {
        const content = await local.read(localDoc.id);
        const put = await provider.put(providerPath(folder, entry.doc), content);
        nextBaseline.set(entry.doc, put.modifiedAt);
        pushed += 1;
      } else if (entry.action === 'conflict-push') {
        // Local wins: push local over remote; keep remote's content as a
        // conflict copy both remotely and locally.
        const losing = await provider.get(providerPath(folder, entry.doc));
        const content = await local.read(localDoc.id);
        const copyName = /** @type {string} */ (entry.conflictCopyAs);
        await provider.put(providerPath(folder, copyName), losing.content);
        const put = await provider.put(providerPath(folder, entry.doc), content);
        await local.put({ name: copyName, content: losing.content });
        nextBaseline.set(entry.doc, put.modifiedAt);
        conflicts += 1;
        conflictCopies.push(copyName);
      } else if (entry.action === 'conflict-pull') {
        // Remote wins: pull over local; keep local's content as a conflict
        // copy both locally and remotely.
        const copyName = /** @type {string} */ (entry.conflictCopyAs);
        const localContent = await local.read(localDoc.id);
        await local.put({ name: copyName, content: localContent });
        await provider.put(providerPath(folder, copyName), localContent);
        const got = await provider.get(providerPath(folder, entry.doc));
        await local.put({ name: entry.doc, content: got.content });
        nextBaseline.set(entry.doc, got.modifiedAt);
        conflicts += 1;
        conflictCopies.push(copyName);
      }
    }

    return {
      plan,
      pulled,
      pushed,
      conflicts,
      untouched: names.size - plan.length,
      lastSynced: nextBaseline,
      conflictCopies,
    };
  }

  return { syncOnce };
}

/** GitHub-flavoured conflict copy name: `README.conflict-1712345678901.md`. */
export function conflictCopyName(name, now) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return name + '.conflict-' + now + '.md';
  return name.slice(0, dot) + '.conflict-' + now + name.slice(dot);
}

/** Join a remote folder and document name; WebDAV uses paths, drives use ids. */
export function providerPath(folder, name) {
  if (!folder) return name;
  return folder.endsWith('/') ? folder + name : folder + '/' + name;
}
