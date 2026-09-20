/**
 * Remote URL guard — the security hinge of the WebDAV adapter.
 *
 * A sync target is user-supplied, which makes it an SSRF ladder: localhost
 * admin panels, cloud metadata endpoints (169.254.169.254), internal services
 * on the LAN. assertSafeRemoteUrl refuses every reserved/private target and
 * only allows http(s). The rule is pure string/IP parsing — no network — so
 * it is exhaustively testable.
 */

const RESERVED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback', 'metadata', 'metadata.google.internal']);

function isPrivateIPv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const o = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (o.some((x) => x > 255)) return true; // malformed — refuse
  const a = o[0], b = o[1];
  if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
  if (a === 169 && b === 254) return true; // link-local (cloud metadata lives here)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // test/protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isReservedIPv6(host) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!h.includes(':')) return false;
  if (h === '::' || h === '::1') return true;
  const first = h.split(':')[0].replace(/^0+(?=.)/, '');
  if (first.startsWith('fe8') || first.startsWith('fe9') || first.startsWith('fea') || first.startsWith('feb')) return true; // link-local
  if (first.startsWith('fc') || first.startsWith('fd')) return true; // unique-local
  if (first.startsWith('ff')) return true; // multicast
  return false;
}

/**
 * Throws unless url is an http(s) URL on a public host. Returns the parsed
 * URL on success so callers never string-join pieces themselves.
 */
export function assertSafeRemoteUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('refusing invalid remote URL: ' + url);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('refusing non-http(s) remote URL scheme: ' + parsed.protocol);
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (RESERVED_HOSTS.has(host)) {
    throw new Error('refusing reserved remote host: ' + host);
  }
  if (isPrivateIPv4(host) || isReservedIPv6(host)) {
    throw new Error('refusing private/reserved remote host: ' + host);
  }
  // A credentials-bearing URL leaks secrets into logs and referrers.
  if (parsed.username || parsed.password) {
    throw new Error('refusing remote URL with embedded credentials');
  }
  // Hand callers the canonical form: no brackets on IPv6 literals, no
  // trailing root dot on FQDNs.
  parsed.hostname = host.replace(/^\[|\]$/g, '');
  return parsed;
}
