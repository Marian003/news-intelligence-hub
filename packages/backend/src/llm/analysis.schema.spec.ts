import {describe, expect, it} from 'vitest';
import {parseAnalysis} from './analysis.schema';

const valid = JSON.stringify({
  summary: 'Microsoft shipped a new AI runtime.',
  importance: 'high',
  entities: [
    {name: 'Microsoft', type: 'company'},
    {name: 'AI runtime', type: 'product'},
  ],
  categories: ['Tech'],
  axes: [{axis: 'region', value: 'global'}],
});

describe('parseAnalysis', () => {
  it('parses a valid object', () => {
    const result = parseAnalysis(valid);
    expect(result.importance).toBe('high');
    expect(result.entities).toHaveLength(2);
    expect(result.categories).toEqual(['Tech']);
    expect(result.axes[0]).toEqual({axis: 'region', value: 'global'});
  });

  it('tolerates markdown code fences and surrounding prose', () => {
    const wrapped = 'Here is the result:\n```json\n' + valid + '\n```\nDone.';
    expect(parseAnalysis(wrapped).summary).toContain('Microsoft');
  });

  it('defaults categories and axes when absent', () => {
    const minimal = JSON.stringify({
      summary: 'A short summary.',
      importance: 'normal',
      entities: [],
    });
    const result = parseAnalysis(minimal);
    expect(result.categories).toEqual([]);
    expect(result.axes).toEqual([]);
  });

  it('throws on non-JSON output', () => {
    expect(() => parseAnalysis('the model refused to answer')).toThrow(/JSON/);
  });

  it('throws on an invalid importance value', () => {
    const bad = JSON.stringify({
      summary: 'x',
      importance: 'critical',
      entities: [],
    });
    expect(() => parseAnalysis(bad)).toThrow(/validation/i);
  });

  it('throws on an invalid entity type', () => {
    const bad = JSON.stringify({
      summary: 'x',
      importance: 'normal',
      entities: [{name: 'Thing', type: 'animal'}],
    });
    expect(() => parseAnalysis(bad)).toThrow(/validation/i);
  });

  it('throws on an empty summary', () => {
    const bad = JSON.stringify({summary: '', importance: 'junk', entities: []});
    expect(() => parseAnalysis(bad)).toThrow(/validation/i);
  });
});
