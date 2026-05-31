import {describe, expect, it} from 'vitest';
import {normalizeEntityName} from './entity-normalize';

describe('normalizeEntityName', () => {
  it('lowercases and trims', () => {
    expect(normalizeEntityName('  Microsoft  ')).toBe('microsoft');
  });

  it('collapses case, punctuation, and legal suffixes to one key', () => {
    const key = normalizeEntityName('Microsoft');
    expect(normalizeEntityName('microsoft')).toBe(key);
    expect(normalizeEntityName('Microsoft Corp.')).toBe(key);
    expect(normalizeEntityName('Microsoft Corporation')).toBe(key);
    expect(normalizeEntityName('Microsoft, Inc.')).toBe(key);
  });

  it('drops a leading "the"', () => {
    expect(normalizeEntityName('The New York Times')).toBe('new york times');
  });

  it('keeps distinct names distinct', () => {
    expect(normalizeEntityName('OpenAI')).not.toBe(
      normalizeEntityName('Microsoft')
    );
    // An acronym is NOT merged deterministically (that needs the LLM layer).
    expect(normalizeEntityName('MSFT')).not.toBe(
      normalizeEntityName('Microsoft')
    );
  });

  it('does not strip a suffix word that is the whole name', () => {
    expect(normalizeEntityName('Co')).toBe('co');
  });

  it('preserves non-Latin scripts', () => {
    expect(normalizeEntityName('Майкрософт')).toBe('майкрософт');
  });
});
