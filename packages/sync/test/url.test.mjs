import { describe, expect, it } from 'vitest';
import { assertSafeRemoteUrl } from '../src/url.mjs';

describe('assertSafeRemoteUrl — accepts public http(s)', () => {
  it('accepts a plain https URL', () => {
    expect(assertSafeRemoteUrl('https://dav.example.com/dav/').hostname).toBe('dav.example.com');
  });

  it('accepts plain http (user test servers)', () => {
    expect(assertSafeRemoteUrl('http://dav.example.com/').protocol).toBe('http:');
  });
});

describe('assertSafeRemoteUrl — refuses everything dangerous', () => {
  const cases = [
    // non-http schemes
    ['file:///etc/passwd', 'scheme'],
    ['ftp://example.com/', 'scheme'],
    ['javascript:alert(1)', 'scheme'],
    ['data:text/html,x', 'scheme'],
    // loopback / this-host
    ['http://localhost:8080/', 'host'],
    ['http://localhost.localdomain/', 'host'],
    ['http://127.0.0.1/', 'host'],
    ['http://127.45.22.11/', 'host'],
    ['http://0.0.0.0/', 'host'],
    // private ranges
    ['http://10.1.2.3/', 'host'],
    ['http://172.16.0.1/', 'host'],
    ['http://172.31.255.255/', 'host'],
    ['http://192.168.1.1/', 'host'],
    ['http://100.64.0.1/', 'host'],
    // link-local — cloud metadata
    ['http://169.254.169.254/latest/meta-data/', 'host'],
    // multicast / reserved / malformed
    ['http://224.0.0.1/', 'host'],
    ['http://255.255.255.255/', 'host'],
    ['http://999.1.1.1/', 'host'],
    // IPv6 loopback / link-local / unique-local / multicast
    ['http://[::1]/', 'host'],
    ['http://[::]/', 'host'],
    ['http://[fe80::1]/', 'host'],
    ['http://[fd00::1]/', 'host'],
    ['http://[ff02::1]/', 'host'],
    // reserved names
    ['http://metadata.google.internal/computeMetadata/v1/', 'host'],
    ['http://metadata/', 'host'],
    // embedded credentials
    ['https://user:pass@dav.example.com/', 'credentials'],
    // garbage
    ['not a url', 'parse'],
    ['', 'parse'],
  ];

  for (const [url, why] of cases) {
    it('refuses ' + JSON.stringify(url) + ' (' + why + ')', () => {
      expect(() => assertSafeRemoteUrl(url)).toThrow();
    });
  }
});

describe('assertSafeRemoteUrl — edge acceptances', () => {
  it('accepts public ipv4 literals', () => {
    expect(assertSafeRemoteUrl('https://1.1.1.1/').hostname).toBe('1.1.1.1');
  });

  it('accepts public ipv6 literals (WHATWG hostname keeps brackets)', () => {
    expect(assertSafeRemoteUrl('https://[2606:4700:4700::1111]/').hostname).toBe('[2606:4700:4700::1111]');
  });

  it('accepts 172.x outside the private range', () => {
    expect(assertSafeRemoteUrl('https://172.32.0.1/').hostname).toBe('172.32.0.1');
  });

  it('strips a trailing root dot from FQDNs', () => {
    expect(assertSafeRemoteUrl('https://dav.example.com./').hostname).toBe('dav.example.com');
  });
});
