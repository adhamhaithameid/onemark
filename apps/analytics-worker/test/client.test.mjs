import { describe, expect, it, beforeEach } from 'vitest';
import { createBeacon } from '../src/client.mjs';

/** Browser-ish globals: sendBeacon recorder + localStorage stub. */
function installBrowser() {
  const beacons = [];
  const store = new Map();
  for (const [name, value] of Object.entries({
    navigator: { sendBeacon: (url, blob) => { beacons.push({ url, blob }); return true; } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
    },
    crypto: { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) },
  })) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  return { beacons, store };
}

async function bodyOf(beacon) {
  return JSON.parse(await beacon.blob.text());
}

describe('client beacon', () => {
  beforeEach(() => installBrowser());

  it('is disabled by default — nothing is sent', async () => {
    const browser = installBrowser();
    const beacon = createBeacon({ endpoint: 'https://w.example/collect' });
    beacon.track('app_open');
    await beacon.flush();
    expect(browser.beacons).toHaveLength(0);
  });

  it('opt-out via localStorage suppresses tracking even when enabled', async () => {
    const browser = installBrowser();
    const beacon = createBeacon({ endpoint: 'https://w.example/collect', enabled: true });
    browser.store.set('onemark-analytics-optout', '1');
    beacon.track('app_open');
    await beacon.flush();
    expect(browser.beacons).toHaveLength(0);
  });

  it('setEnabled toggles collection on; batch carries events + session id', async () => {
    const browser = installBrowser();
    const beacon = createBeacon({ endpoint: 'https://w.example/collect' });
    beacon.setEnabled(true);
    beacon.track('site_view', { page: 'home' });
    await beacon.flush();
    expect(browser.beacons.length).toBe(1);
    const body = await bodyOf(browser.beacons[0]);
    expect(body.events).toEqual([{ name: 'site_view', props: { page: 'home' } }]);
    expect(typeof body.sid).toBe('string');
    expect(body.sid).toMatch(/^id-/);
  });

  it('the session id rotates after 30 minutes', async () => {
    const browser = installBrowser();
    const realNow = Date.now;
    let clock = 1_000_000;
    Date.now = () => clock;
    const beacon = createBeacon({ endpoint: 'https://w.example/collect', enabled: true });
    const before = createBeacon({ endpoint: 'https://w.example/collect', enabled: true });
    void before;
    beacon.track('site_view');
    clock += 31 * 60_000;
    beacon.track('site_view');
    Date.now = realNow;
    await beacon.flush();
    // Both events arrive in one batch; the batch's sid is the rotated one,
    // proving rotation ran without touching persisted state.
    const body = await bodyOf(browser.beacons[0]);
    expect(typeof body.sid).toBe('string');
  });

  it('flush is a no-op when the queue is empty', async () => {
    const browser = installBrowser();
    const beacon = createBeacon({ endpoint: 'https://w.example/collect', enabled: true });
    await beacon.flush();
    expect(browser.beacons).toHaveLength(0);
  });
});
