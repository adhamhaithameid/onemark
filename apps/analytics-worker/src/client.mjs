/**
 * Drop-in analytics beacon for OneMark surfaces (ADR-0019).
 *
 * Privacy law: aggregate events only; a rotating in-memory session id (30-min
 * max age) is the maximum identifier; disabled by default and trivially
 * opt-out-able. Zero dependencies; browser-only.
 */

/**
 * @param {{endpoint: string, enabled?: boolean}} options
 */
export function createBeacon(options) {
  const endpoint = options.endpoint;
  // Default OFF: analytics light up only when the app explicitly enables.
  let enabled = options.enabled === true;
  const queue = [];
  let sessionId = newId();
  let sessionStarted = Date.now();
  let flushTimer;

  function newId() {
    const c = globalThis.crypto;
    return c && c.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2);
  }

  function optedOut() {
    try {
      return globalThis.localStorage?.getItem('onemark-analytics-optout') === '1';
    } catch {
      return false;
    }
  }

  function session() {
    // Rotating: at most 30 minutes per id, then a fresh random one. Memory
    // only — never persisted, never sent anywhere but /collect.
    if (Date.now() - sessionStarted > 30 * 60_000) {
      sessionId = newId();
      sessionStarted = Date.now();
    }
    return sessionId;
  }

  async function flush() {
    if (!enabled || optedOut() || queue.length === 0) return;
    const events = queue.splice(0, queue.length);
    const body = JSON.stringify({ sid: session(), events });
    // 64KB hard cap; drop rather than grow (aggregate counts, not data).
    if (body.length > 64 * 1024) return;
    try {
      if (globalThis.navigator?.sendBeacon) {
        globalThis.navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      } else {
        await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
      }
    } catch {
      // Analytics must never surface as a user-facing failure.
    }
  }

  return {
    /** @param {string} name @param {Record<string,string>} [props] */
    track(name, props = {}) {
      if (!enabled || optedOut()) return;
      queue.push({ name, props });
      if (queue.length >= 10) void flush();
      clearTimeout(flushTimer);
      flushTimer = setTimeout(() => void flush(), 30_000);
    },
    setEnabled(value) {
      enabled = value === true;
    },
    flush,
  };
}
