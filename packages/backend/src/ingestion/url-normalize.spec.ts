import {describe, expect, it} from 'vitest';
import {normalizeUrl} from './url-normalize';

describe('normalizeUrl', () => {
  it('lowercases scheme and host but preserves the path case', () => {
    expect(normalizeUrl('HTTP://Example.COM/Path/To/Article')).toBe(
      'http://example.com/Path/To/Article'
    );
  });

  it('drops default ports and the fragment', () => {
    expect(normalizeUrl('https://example.com:443/post#section')).toBe(
      'https://example.com/post'
    );
    expect(normalizeUrl('http://example.com:80/post')).toBe(
      'http://example.com/post'
    );
  });

  it('keeps a non-default port', () => {
    expect(normalizeUrl('http://example.com:8080/post')).toBe(
      'http://example.com:8080/post'
    );
  });

  it('removes a trailing slash except on the root path', () => {
    expect(normalizeUrl('https://example.com/post/')).toBe(
      'https://example.com/post'
    );
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('strips tracking params and sorts the rest for stable comparison', () => {
    expect(
      normalizeUrl('https://example.com/p?utm_source=x&b=2&a=1&fbclid=z')
    ).toBe('https://example.com/p?a=1&b=2');
  });

  it('treats cosmetically different links to the same resource as equal', () => {
    const a = normalizeUrl(
      'https://Example.com/Article/?utm_campaign=news#top'
    );
    const b = normalizeUrl('https://example.com:443/Article');
    expect(a).toBe(b);
  });

  it('falls back to a trimmed string for an unparseable URL', () => {
    expect(normalizeUrl('  not a url  ')).toBe('not a url');
  });
});
