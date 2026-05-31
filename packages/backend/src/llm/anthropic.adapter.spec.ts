import {describe, expect, it, vi} from 'vitest';
import {AnthropicAdapter} from './anthropic.adapter';
import type {FetchLike, FetchResponse} from './http';
import type {ArticleAnalysisInput} from './llm.types';

const input: ArticleAnalysisInput = {
  title: 'T',
  content: 'body',
  categories: [],
  axes: [],
  maxTokens: 256,
};

function response(body: unknown, ok = true, status = 200): FetchResponse {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

// Anthropic has no JSON mode; the model may fence the JSON — the adapter must
// still parse it.
const fencedJson =
  '```json\n' +
  JSON.stringify({summary: 'A summary.', importance: 'normal', entities: []}) +
  '\n```';
const okPayload = {
  content: [{type: 'text', text: fencedJson}],
  usage: {input_tokens: 50, output_tokens: 10},
};

describe('AnthropicAdapter', () => {
  it('builds the request and parses fenced JSON + usage', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => response(okPayload));
    const adapter = new AnthropicAdapter({
      apiKey: 'secret',
      model: 'claude-test',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    });

    const result = await adapter.analyzeArticle(input);
    expect(result.result.importance).toBe('normal');
    expect(result.usage).toEqual({promptTokens: 50, completionTokens: 10});
    expect(result.provider).toBe('anthropic');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/messages');
    expect(init.headers['x-api-key']).toBe('secret');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    const sent = JSON.parse(init.body) as Record<string, unknown>;
    expect(sent.system).toBeDefined();
    expect(sent.max_tokens).toBe(256);
  });

  it('throws without an API key', async () => {
    const adapter = new AnthropicAdapter({
      apiKey: '',
      model: 'claude-test',
      timeoutMs: 1000,
      fetchImpl: vi.fn<FetchLike>(),
    });
    await expect(adapter.analyzeArticle(input)).rejects.toThrow(
      /ANTHROPIC_API_KEY/
    );
  });

  it('throws on a non-200 response', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      response({error: 'overloaded'}, false, 529)
    );
    const adapter = new AnthropicAdapter({
      apiKey: 'secret',
      model: 'claude-test',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    });
    await expect(adapter.analyzeArticle(input)).rejects.toThrow(/529/);
  });
});
