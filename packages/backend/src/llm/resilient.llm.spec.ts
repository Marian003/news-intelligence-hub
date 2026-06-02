import {describe, expect, it, vi} from 'vitest';
import type {
  ArticleAnalysisInput,
  ArticleAnalysisResponse,
  DigestInput,
  DigestResponse,
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

const digestInput: DigestInput = {
  period: 'week',
  topEntities: [],
  topCategories: [],
  articles: [],
  maxTokens: 256,
};

function digestResponse(provider: string): DigestResponse {
  return {
    result: {summary: `digest from ${provider}`},
    usage: {promptTokens: 1, completionTokens: 1},
    provider,
    model: 'm',
  };
}

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
  impl: () => Promise<ArticleAnalysisResponse>,
  digestImpl: () => Promise<DigestResponse> = async () =>
    digestResponse(provider)
): LlmService {
  return {
    provider,
    model: 'm',
    analyzeArticle: vi.fn(impl),
    buildDigest: vi.fn(digestImpl),
    matchEntities: vi.fn(async () => ({
      result: {matchId: null},
      usage: {promptTokens: 1, completionTokens: 1},
      provider,
      model: 'm',
    })),
  };
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

  it('fails over for buildDigest too', async () => {
    const primary = adapter(
      'openai',
      async () => response('openai'),
      async () => {
        throw new Error('digest down');
      }
    );
    const fallback = adapter('anthropic', async () => response('anthropic'));
    const service = new ResilientLlmService([primary, fallback]);

    const result = await service.buildDigest(digestInput);
    expect(result.provider).toBe('anthropic');
    expect(result.result.summary).toContain('anthropic');
  });

  it('exposes the primary provider/model', () => {
    const service = new ResilientLlmService([
      adapter('anthropic', async () => response('anthropic')),
    ]);
    expect(service.provider).toBe('anthropic');
  });
});
