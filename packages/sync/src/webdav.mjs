/**
 * WebDAV adapter (P7, ADR-0018) — covers "a server": the user's own host,
 * Nextcloud, self-hosted DAV. Auth is Basic (over https, enforced by the URL
 * guard) or a bearer token. Zero dependencies; minimal PROPFIND parsing.
 *
 * Security: the base URL passes assertSafeRemoteUrl (no private/reserved
 * hosts, no embedded credentials in the URL — credentials go in headers).
 */
import { assertSafeRemoteUrl } from './url.mjs';

/**
 * @param {string} baseUrl server root, e.g. https://dav.example.com/dav/
 * @param {{ username?: string, password?: string, bearer?: string, fetchImpl?: typeof fetch }} auth
 */
export function createWebdavProvider(baseUrl, auth = {}) {
  const base = assertSafeRemoteUrl(baseUrl);
  const root = base.pathname.endsWith('/') ? base.pathname : base.pathname + '/';
  const fetchImpl = auth.fetchImpl ?? fetch;

  function headers(extra) {
    const h = { ...extra };
    if (auth.bearer) h['Authorization'] = 'Bearer ' + auth.bearer;
    else if (auth.username !== undefined) {
      // Basic auth, header-borne only (the URL guard rejects inline creds).
      const value = auth.username + ':' + (auth.password ?? '');
      h['Authorization'] = 'Basic ' + btoa(value);
    }
    return h;
  }

  async function request(path, init) {
    const url = base.origin + joinPath(root, path);
    const res = await fetchImpl(url, init);
    if (!res.ok && res.status !== 404) {
      throw new Error('webdav ' + init.method + ' ' + path + ' failed: ' + res.status);
    }
    return res;
  }

  return {
    id: /** @type {const} */ ('webdav'),
    displayName: 'WebDAV',

    async list(folder) {
      const res = await request(folder, {
        method: 'PROPFIND',
        headers: headers({ Depth: '1', 'Content-Type': 'application/xml' }),
        body: PROPFIND_BODY,
      });
      if (res.status === 404) return [];
      const xml = await res.text();
      return parsePropfind(xml, root).filter((r) => r.path !== joinPath(root, folder));
    },

    async get(path) {
      const res = await request(path, { method: 'GET', headers: headers({}) });
      if (res.status === 404) throw new Error('webdav get ' + path + ': not found');
      return {
        content: await res.text(),
        modifiedAt: parseHttpDate(res.headers.get('last-modified')),
        etag: res.headers.get('etag') ?? undefined,
      };
    },

    async put(path, content, ifMatchEtag) {
      const extra = { 'Content-Type': 'text/markdown; charset=utf-8' };
      if (ifMatchEtag) extra['If'] = '<' + joinPath(root, path) + '> (' + ifMatchEtag + ')';
      const res = await request(path, { method: 'PUT', headers: headers(extra), body: content });
      if (!res.ok) throw new Error('webdav put ' + path + ' failed: ' + res.status);
      return {
        modifiedAt: parseHttpDate(res.headers.get('last-modified')) ?? Date.now(),
        etag: res.headers.get('etag') ?? undefined,
      };
    },

    async remove(path) {
      const res = await request(path, { method: 'DELETE', headers: headers({}) });
      if (!res.ok && res.status !== 404) throw new Error('webdav delete ' + path + ' failed: ' + res.status);
    },
  };
}

const PROPFIND_BODY =
  '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getlastmodified/><d:getetag/><d:getcontentlength/><d:resourcetype/></d:prop></d:propfind>';

function joinPath(root, path) {
  // Absolute paths win — the provider's methods take server-absolute paths,
  // which must never be re-joined under the root.
  if (path.startsWith('/')) return path;
  const p = path.endsWith('/') ? path.slice(0, -1) : path;
  if (!p) return root;
  return root.endsWith('/') ? root + p : root + '/' + p;
}

/**
 * Parse a Depth:1 PROPFIND multistatus into refs. Deliberately regex-minimal:
 * DAV servers vary wildly in namespace prefixes, so we match on the LOCAL
 * part of element names rather than any prefix.
 */
export function parsePropfind(xml, root) {
  /** @type {Array<any>} */
  const refs = [];
  const responses = xml.split(/<\/(?:[A-Za-z0-9_-]*:)?response>/i);
  for (const chunk of responses) {
    const hrefMatch = /<(?:[A-Za-z0-9_-]*:)?href[^>]*>([^<]+)<\//i.exec(chunk);
    if (!hrefMatch) continue;
    const href = decodeURIComponent(hrefMatch[1]);
    const nameMatch = /<(?:[A-Za-z0-9_-]*:)?displayname[^>]*>([^<]*)<\//i.exec(chunk);
    const modifiedMatch = /<(?:[A-Za-z0-9_-]*:)?getlastmodified[^>]*>([^<]+)<\//i.exec(chunk);
    const etagMatch = /<(?:[A-Za-z0-9_-]*:)?getetag[^>]*>([^<]+)<\//i.exec(chunk);
    const sizeMatch = /<(?:[A-Za-z0-9_-]*:)?getcontentlength[^>]*>(\d+)<\//i.exec(chunk);
    const isCollection = /<(?:[A-Za-z0-9_-]*:)?collection\s*\/?>/i.test(chunk);
    const path = href.startsWith('http') ? new URL(href).pathname : href;
    if (isCollection) continue;
    if (!/\.md$/i.test(path)) continue;
    refs.push({
      id: path,
      name: path.split('/').filter(Boolean).pop() ?? path,
      path,
      modifiedAt: parseHttpDate(modifiedMatch?.[1]) ?? 0,
      size: sizeMatch ? Number(sizeMatch[1]) : 0,
      etag: etagMatch?.[1],
    });
  }
  return refs;
}

/** RFC 1123 date (`Last-Modified`) → epoch ms; 0 when absent/unparseable. */
export function parseHttpDate(value) {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}
