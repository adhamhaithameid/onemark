/**
 * Payload validation for the analytics collector (ADR-0019).
 * Aggregate counts only: the allowlists below are the whole surface — an
 * event that cannot be described by this vocabulary cannot be stored.
 * Privacy law: no PII, no free-text, no identifiers. Reject, never strip,
 * so malformed or hostile callers get nothing stored.
 */

export const EVENT_NAMES = ['app_open', 'doc_open', 'render', 'feature_use', 'error', 'site_view'];

/** Per-event property allowlists (everything else is rejected). */
export const EVENT_PROPS = {
  app_open: ['version', 'platform'],
  doc_open: ['size_bucket'],
  render: ['size_bucket', 'ms_bucket', 'engine'],
  feature_use: ['feature'],
  error: ['kind'],
  site_view: ['page'],
};

export const SIZE_BUCKETS = ['<10KB', '10-100KB', '100KB-1MB', '>1MB'];
export const MS_BUCKETS = ['<50', '50-100', '100-250', '250-500', '500-1000', '>1000'];
const ENGINES = ['comrak-wasm-worker', 'comrak-wasm', 'comrak-native'];
const PAGES = ['home', 'docs', 'app', 'faq', 'roadmap'];
const FEATURES = ['paste', 'dragdrop', 'save', 'theme', 'export-html', 'sync', 'mermaid-hydrated'];
const ERROR_KINDS = ['parse-trap', 'render-failed', 'storage-full', 'sync-failed', 'hydrate-failed'];
const PLATFORMS = ['web', 'macos', 'windows', 'linux', 'ios', 'android'];

const ENUM_PROPS = {
  size_bucket: SIZE_BUCKETS,
  ms_bucket: MS_BUCKETS,
  engine: ENGINES,
  page: PAGES,
  feature: FEATURES,
  kind: ERROR_KINDS,
  platform: PLATFORMS,
};

const MAX_BODY_BYTES = 16 * 1024;
const MAX_EVENTS = 20;
const MAX_PROPS = 8;
const MAX_PROP_LEN = 64;
/** Free-form values must be short slugs: letters, digits, dash, dot, slash. */
const SAFE_VALUE = /^[a-z0-9][a-z0-9./_-]{0,63}$/;

/** PRD §4 workload buckets, shared with the client beacon. */
export function sizeBucket(bytes) {
  if (bytes < 10 * 1024) return '<10KB';
  if (bytes < 100 * 1024) return '10-100KB';
  if (bytes < 1024 * 1024) return '100KB-1MB';
  return '>1MB';
}

export function bucketize(ms) {
  if (ms < 50) return '<50';
  if (ms < 100) return '50-100';
  if (ms < 250) return '100-250';
  if (ms < 500) return '250-500';
  if (ms < 1000) return '500-1000';
  return '>1000';
}

/**
 * @param {unknown} body parsed JSON body
 * @returns {{ok: true, events: Array<{name: string, props: Record<string,string>}>} | {ok: false, reason: string}}
 */
export function validatePayload(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'body must be an object' };
  }
  const events = body.events;
  if (!Array.isArray(events)) return { ok: false, reason: 'events must be an array' };
  if (events.length === 0) return { ok: false, reason: 'events is empty' };
  if (events.length > MAX_EVENTS) return { ok: false, reason: 'too many events in batch' };

  const out = [];
  for (const event of events) {
    if (event === null || typeof event !== 'object' || Array.isArray(event)) {
      return { ok: false, reason: 'event must be an object' };
    }
    const { name, props = {} } = event;
    if (typeof name !== 'string' || !EVENT_NAMES.includes(name)) {
      return { ok: false, reason: 'unknown event name' };
    }
    if (props === null || typeof props !== 'object' || Array.isArray(props)) {
      return { ok: false, reason: 'props must be an object' };
    }
    const keys = Object.keys(props);
    if (keys.length > MAX_PROPS) return { ok: false, reason: 'too many props' };
    const allowed = EVENT_PROPS[name];
    const clean = {};
    for (const key of keys) {
      if (!allowed.includes(key)) return { ok: false, reason: 'prop not allowed for event: ' + key };
      const value = props[key];
      if (typeof value !== 'string') return { ok: false, reason: 'prop value must be a string: ' + key };
      if (value.length > MAX_PROP_LEN) return { ok: false, reason: 'prop value too long: ' + key };
      const enumValues = ENUM_PROPS[key];
      if (enumValues) {
        // Bucket/enum props: membership IS the validation (values like '<50'
        // are deliberate vocabulary, not free text).
        if (!enumValues.includes(value)) return { ok: false, reason: 'prop value not in bucket enum: ' + key };
      } else if (!SAFE_VALUE.test(value)) {
        return { ok: false, reason: 'prop value not a safe token: ' + key };
      }
      clean[key] = value;
    }
    out.push({ name, props: clean });
  }
  return { ok: true, events: out };
}

/** Size guard for the raw body, applied before JSON parsing. */
export function bodyTooLarge(text) {
  return text.length > MAX_BODY_BYTES;
}
