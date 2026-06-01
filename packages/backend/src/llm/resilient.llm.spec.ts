import {describe, expect, it, vi} from 'vitest';
import type {
  ArticleAnalysisInput,
  ArticleAnalysisResponse,
  LlmService,
} from './llm.types';
import {ResilientLlmService} from './resilient.llm';

const input: ArticleAnalysisInput = {
  title: 'T',
  content: 'body',
  categories: [],
  axes: [],
  maxTokens: 256,
};

function response(provider: string): ArticleAnalysisResponse {
  return {
    result: {
      summary: `from ${provider}`,
      importance: 'normal',
      entities: [],
      categories: [],
      axes: [],
    },
    usage: {promptTokens: 1, completionTokens: 1},
    provider,
    model: 'm',
  };
}

function adapter(
  provider: string,
  impl: () => Promise<ArticleAnalysisResponse>
): LlmService {
  return {provider, model: 'm', analyzeArticle: vi.fn(impl)};
}

describe('ResilientLlmService', () => {
  it('uses the primary when it succeeds and does not call the fallback', async () => {
    const primary = adapter('openai', async () => response('openai'));
    const fallback = adapter('anthropic', async () => response('anthropic'));
    const service = new ResilientLlmService([primary, fallback]);

    const result = await service.analyzeArticle(input);
    expect(result.provider).toBe('openai');
    expect(fallback.analyzeArticle).not.toHaveBeenCalled();
  });

  it('fails over to the next provider on error', async () => {
    const primary = adapter('openai', async () => {
      throw new Error('rate limited');
    });
    const fallback = adapter('anthropic', async () => response('anthropic'));
    const service = new ResilientLlmService([primary, fallback]);

    const result = await service.analyzeArticle(input);
    expect(result.provider).toBe('anthropic');
    expect(primary.analyzeArticle).toHaveBeenCalled();
  });

  it('throws the last error when every provider fails', async () => {
    const primary = adapter('openai', async () => {
      throw new Error('down-1');
    });
    const fallback = adapter('anthropic', async () => {
      throw new Error('down-2');
    });
    const service = new ResilientLlmService([primary, fallback]);

    await expect(service.analyzeArticle(input)).rejects.toThrow('down-2');
  });

  it('exposes the primary provider/model', () => {
    const service = new ResilientLlmService([
      adapter('anthropic', async () => response('anthropic')),
    ]);
    expect(service.provider).toBe('anthropic');
  });
});
