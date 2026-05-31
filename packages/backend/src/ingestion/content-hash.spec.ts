import {describe, expect, it} from 'vitest';
import {contentHash, normalizeForHash} from './content-hash';

describe('normalizeForHash', () => {
  it('collapses whitespace and lowercases', () => {
    expect(normalizeForHash('  Hello\n\tWORLD  ')).toBe('hello world');
  });
});

describe('contentHash', () => {
  it('is stable across whitespace and case differences', () => {
    const a = contentHash({title: 'Big News', body: 'Something   happened.'});
    const b = contentHash({title: 'big news', body: 'Something happened.'});
    expect(a).toBe(b);
  });

  it('differs when the body differs', () => {
    const a = contentHash({title: 'T', body: 'one'});
    const b = contentHash({title: 'T', body: 'two'});
    expect(a).not.toBe(b);
  });

  it('returns a 64-char hex sha256 digest', () => {
    expect(contentHash({title: 'x', body: 'y'})).toMatch(/^[a-f0-9]{64}$/);
  });

  it('separates title and body so they cannot be confused', () => {
    // "ab" + "" must not collide with "a" + "b".
    expect(contentHash({title: 'ab', body: ''})).not.toBe(
      contentHash({title: 'a', body: 'b'})
    );
  });
});
