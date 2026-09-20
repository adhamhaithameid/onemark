import { describe, expect, it } from 'vitest';
import { createWebdavProvider, parsePropfind } from '../src/webdav.mjs';

const BASE = 'https://dav.example.com/dav/';

const PROPFIND_RESPONSE = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/README.md</d:href>
    <d:propstat><d:prop>
      <d:displayname>README.md</d:displayname>
      <d:getlastmodified>Mon, 15 Jan 2024 10:00:00 GMT</d:getlastmodified>
      <d:getetag>"abc-1"</d:getetag>
      <d:getcontentlength>42</d:getcontentlength>
    </d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/photos/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/logo.png</d:href>
    <d:propstat><d:prop><d:getcontentlength>9</d:getcontentlength></d:prop></d:propstat>
  </d:response>
</d:multistatus>`;

function mockFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return handler(url, init ?? {});
  };
  impl.calls = calls;
  return impl;
}

function okResponse(body, headers = {}) {
  return {
    ok: true,
    status: 200,
    text: async () => body,
    headers: new Map(Object.entries(headers)),
  };
}

describe('webdav provider', () => {
  it('lists markdown files from a PROPFIND, skipping collections and non-md', async () => {
    const fetchImpl = mockFetch(() => okResponse(PROPFIND_RESPONSE));
    const provider = createWebdavProvider(BASE, { fetchImpl });
    const refs = await provider.list('/dav/');
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ name: 'README.md', path: '/dav/README.md', size: 42, etag: '"abc-1"' });
    expect(refs[0].modifiedAt).toBe(Date.parse('Mon, 15 Jan 2024 10:00:00 GMT'));
  });

  it('sends PROPFIND with Depth 1 and Authorization header (Basic)', async () => {
    const fetchImpl = mockFetch(() => okResponse(PROPFIND_RESPONSE));
    const provider = createWebdavProvider(BASE, { username: 'u', password: 'p', fetchImpl });
    await provider.list('/dav/');
    const init = fetchImpl.calls[0].init;
    expect(init.method).toBe('PROPFIND');
    expect(init.headers['Depth']).toBe('1');
    expect(init.headers['Authorization']).toBe('Basic ' + btoa('u:p'));
  });

  it('supports bearer auth', async () => {
    const fetchImpl = mockFetch(() => okResponse(PROPFIND_RESPONSE));
    const provider = createWebdavProvider(BASE, { bearer: 'tok123', fetchImpl });
    await provider.list('/dav/');
    expect(fetchImpl.calls[0].init.headers['Authorization']).toBe('Bearer tok123');
  });

  it('GET reads content with last-modified and etag', async () => {
    const fetchImpl = mockFetch(() => okResponse('hello', { 'last-modified': 'Tue, 02 Jan 2024 00:00:00 GMT', etag: '"e-7"' }));
    const provider = createWebdavProvider(BASE, { fetchImpl });
    const got = await provider.get('/dav/README.md');
    expect(got).toMatchObject({ content: 'hello', etag: '"e-7"' });
    expect(got.modifiedAt).toBe(Date.parse('Tue, 02 Jan 2024 00:00:00 GMT'));
  });

  it('PUT sends content and reports If-Match when an etag is given', async () => {
    const fetchImpl = mockFetch(() => okResponse('', { etag: '"e-8"' }));
    const provider = createWebdavProvider(BASE, { fetchImpl });
    await provider.put('/dav/README.md', 'new body', '"e-7"');
    const init = fetchImpl.calls[0].init;
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('new body');
    expect(init.headers['If']).toBe('</dav/README.md> ("e-7")');
  });

  it('DELETE succeeds and tolerates 404', async () => {
    const fetchImpl = mockFetch((url, init) => {
      if (init.method === 'DELETE') return { ok: false, status: 404, text: async () => '', headers: new Map() };
      return okResponse('');
    });
    const provider = createWebdavProvider(BASE, { fetchImpl });
    await expect(provider.remove('/dav/gone.md')).resolves.toBeUndefined();
  });

  it('surfaces server errors as failures', async () => {
    const fetchImpl = mockFetch(() => ({ ok: false, status: 502, text: async () => '', headers: new Map() }));
    const provider = createWebdavProvider(BASE, { fetchImpl });
    await expect(provider.put('/dav/x.md', 'y')).rejects.toThrow('502');
  });

  it('refuses private/reserved base URLs before any network call', () => {
    expect(() => createWebdavProvider('http://127.0.0.1:9000/dav/')).toThrow();
    expect(() => createWebdavProvider('file:///dav/')).toThrow();
  });
});

describe('parsePropfind', () => {
  it('extracts only markdown files', () => {
    const refs = parsePropfind(PROPFIND_RESPONSE, '/dav/');
    expect(refs.map((r) => r.name)).toEqual(['README.md']);
  });

  it('returns empty for an empty multistatus', () => {
    expect(parsePropfind('<d:multistatus></d:multistatus>', '/dav/')).toEqual([]);
  });
});
