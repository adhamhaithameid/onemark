/**
 * @onemark/sync — opt-in document sync to storage the user already owns.
 * See ADR-0018 and README.md. v1 ships the WebDAV adapter (covers "a
 * server": Nextcloud, self-hosted DAV) plus the provider types the Google
 * Drive / OneDrive adapters will complete after OAuth client registration.
 */
export { assertSafeRemoteUrl } from './url.mjs';
export { createSyncEngine, conflictCopyName, providerPath } from './engine.mjs';
export { createWebdavProvider, parsePropfind, parseHttpDate } from './webdav.mjs';
