import {describe, expect, it, vi} from 'vitest';
import {ResilientLlmService} from './resilient.llm';
import type {ArticleAnalysisInput, LlmService} from './llm.types';

const input = {} as ArticleAnalysisInput;

function adapter(provider: string, behaviour: 'ok' | 'throw'): LlmService {
  return {
    provider,
    model: 'test-model',
    analyzeArticle: vi.fn(async () => {
      if (behaviour === 'throw') throw new Error(`${provider} down`);
      return {} as never;
    }),
  } as unknown as LlmService;
}

describe('ResilientLlmService call observer', () => {
  it('reports a success for the provider that answered', async () => {
    const onCall = vi.fn();
    await new ResilientLlmService(
      [adapter('anthropic', 'ok')],
      onCall
    ).analyzeArticle(input);
    expect(onCall.mock.calls).toEqual([['anthropic', 'success']]);
  });

  it('reports the failure AND the failover success, so both are attributed', async () => {
    const onCall = vi.fn();
    await new ResilientLlmService(
      [adapter('openai', 'throw'), adapter('anthropic', 'ok')],
      onCall
    ).analyzeArticle(input);

    expect(onCall.mock.calls).toEqual([
      ['openai', 'failure'],
      ['anthropic', 'success'],
    ]);
  });

  it('still rethrows when every provider fails, and records each failure', async () => {
    const onCall = vi.fn();
    const service = new ResilientLlmService(
      [adapter('openai', 'throw'), adapter('anthropic', 'throw')],
      onCall
    );
    await expect(service.analyzeArticle(input)).rejects.toThrow(
      'anthropic down'
    );
    expect(onCall.mock.calls).toEqual([
      ['openai', 'failure'],
      ['anthropic', 'failure'],
    ]);
  });

  it('works without an observer (the callback is optional)', async () => {
    const service = new ResilientLlmService([adapter('anthropic', 'ok')]);
    await expect(service.analyzeArticle(input)).resolves.toBeDefined();
  });
});
