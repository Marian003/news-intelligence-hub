import {describe, expect, it} from 'vitest';
import {preFilter, stripToText} from './pre-filter';

const thresholds = {minChars: 200, minWords: 40};

// A genuine paragraph comfortably over both thresholds with varied vocabulary.
const realArticle = Array.from({length: 60}, (_, i) => `word${i}`).join(' ');

describe('stripToText', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripToText('<p>Hello   <b>there</b></p>\n\nworld')).toBe(
      'Hello there world'
    );
  });
});

describe('preFilter', () => {
  it('rejects empty content', () => {
    const result = preFilter({content: '   '}, thresholds);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('empty');
  });

  it('rejects content below the character threshold', () => {
    const result = preFilter({content: 'Too short.'}, thresholds);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('too_short');
  });

  it('rejects content with too few words even if long enough in chars', () => {
    // One very long token: over minChars, but a single word.
    const result = preFilter({content: 'x'.repeat(250)}, thresholds);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('too_few_words');
  });

  it('rejects repetitive low-information filler', () => {
    const spammy = Array.from({length: 80}, () => 'buy now').join(' ');
    const result = preFilter({content: spammy}, thresholds);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('low_information');
  });

  it('accepts a normal article and reports its metrics', () => {
    const result = preFilter({content: realArticle}, thresholds);
    expect(result.accepted).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.wordCount).toBe(60);
    expect(result.textLength).toBeGreaterThanOrEqual(thresholds.minChars);
  });

  it('honors configurable thresholds', () => {
    // Same text accepted under loose thresholds, rejected under strict ones.
    const text = 'alpha beta gamma delta epsilon zeta eta theta';
    expect(
      preFilter({content: text}, {minChars: 5, minWords: 3}).accepted
    ).toBe(true);
    expect(
      preFilter({content: text}, {minChars: 5, minWords: 50}).accepted
    ).toBe(false);
  });
});
