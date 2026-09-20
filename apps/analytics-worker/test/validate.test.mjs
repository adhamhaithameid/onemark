import { describe, expect, it } from 'vitest';
import { validatePayload, bodyTooLarge, sizeBucket, bucketize } from '../src/validate.mjs';

describe('validatePayload', () => {
  it('accepts a valid batch', () => {
    const r = validatePayload({ events: [{ name: 'app_open', props: { version: '0.1.0', platform: 'web' } }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.events[0].props.platform).toBe('web');
  });

  it('rejects non-object bodies, missing/empty/oversized batches', () => {
    expect(validatePayload(null).ok).toBe(false);
    expect(validatePayload([]).ok).toBe(false);
    expect(validatePayload({}).ok).toBe(false);
    expect(validatePayload({ events: [] }).ok).toBe(false);
    expect(validatePayload({ events: new Array(21).fill({ name: 'error' }) }).ok).toBe(false);
  });

  it('rejects unknown event names', () => {
    expect(validatePayload({ events: [{ name: 'page_view' }] }).ok).toBe(false);
  });

  it('rejects props outside the per-event allowlist', () => {
    expect(validatePayload({ events: [{ name: 'app_open', props: { url: 'https://x' } }] }).ok).toBe(false);
  });

  it('rejects values that are not short safe tokens (PII defense)', () => {
    expect(validatePayload({ events: [{ name: 'error', props: { kind: 'a'.repeat(65) } }] }).ok).toBe(false);
    expect(validatePayload({ events: [{ name: 'error', props: { kind: 'has space' } }] }).ok).toBe(false);
    expect(validatePayload({ events: [{ name: 'error', props: { kind: 'a@b.com' } }] }).ok).toBe(false);
    expect(validatePayload({ events: [{ name: 'error', props: { kind: 7 } }] }).ok).toBe(false);
  });

  it('rejects bucket values outside the enums', () => {
    expect(validatePayload({ events: [{ name: 'render', props: { ms_bucket: 'fast' } }] }).ok).toBe(false);
    expect(validatePayload({ events: [{ name: 'render', props: { size_bucket: 'huge' } }] }).ok).toBe(false);
  });

  it('accepts full render events', () => {
    const r = validatePayload({
      events: [{ name: 'render', props: { size_bucket: '10-100KB', ms_bucket: '50-100', engine: 'comrak-wasm-worker' } }],
    });
    expect(r.ok).toBe(true);
  });
});

describe('buckets', () => {
  it('sizeBucket boundaries', () => {
    expect(sizeBucket(0)).toBe('<10KB');
    expect(sizeBucket(10 * 1024)).toBe('10-100KB');
    expect(sizeBucket(100 * 1024)).toBe('100KB-1MB');
    expect(sizeBucket(1024 * 1024)).toBe('>1MB');
  });

  it('bucketize boundaries', () => {
    expect(bucketize(49)).toBe('<50');
    expect(bucketize(50)).toBe('50-100');
    expect(bucketize(99)).toBe('50-100');
    expect(bucketize(100)).toBe('100-250');
    expect(bucketize(249)).toBe('100-250');
    expect(bucketize(250)).toBe('250-500');
    expect(bucketize(999)).toBe('500-1000');
    expect(bucketize(1000)).toBe('>1000');
  });
});

describe('bodyTooLarge', () => {
  it('caps at 16KB', () => {
    expect(bodyTooLarge('x'.repeat(16 * 1024 + 1))).toBe(true);
    expect(bodyTooLarge('x'.repeat(1024))).toBe(false);
  });
});
