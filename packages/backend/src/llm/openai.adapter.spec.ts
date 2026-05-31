import {describe, expect, it, vi} from 'vitest';
import type {FetchLike, FetchResponse} from './http';
import type {ArticleAnalysisInput} from './llm.types';
import {OpenAiAdapter} from './openai.adapter';

const input: ArticleAnalysisInput = {
  title: 'T',
  content: 'body',
  categories: [],
  axes: [],
  maxTokens: 512,
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

const okPayload = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          summary: 'A summary.',
          importance: 'high',
          entities: [{name: 'OpenAI', type: 'company'}],
        }),
      },
    },
  ],
  usage: {prompt_tokens: 100, completion_tokens: 20},
};

describe('OpenAiAdapter', () => {
  it('builds the request and parses result + usage', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => response(okPayload));
    const adapter = new OpenAiAdapter({
      apiKey: 'k',
      model: 'gpt-test',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    });

    const result = await adapter.analyzeArticle(input);
    expect(result.result.importance).toBe('high');
    expect(result.result.entities[0].name).toBe('OpenAI');
    expect(result.usage).toEqual({promptTokens: 100, completionTokens: 20});
    expect(result.provider).toBe('openai');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer k');
    const sent = JSON.parse(init.body) as Record<string, unknown>;
    expect(sent.response_format).toEqual({type: 'json_object'});
    expect(sent.max_tokens).toBe(512);
  });

  it('throws without an API key (and never calls fetch)', async () => {
    const fetchMock = vi.fn<FetchLike>();
    const adapter = new OpenAiAdapter({
      apiKey: '',
      model: 'gpt-test',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    });
    await expect(adapter.analyzeArticle(input)).rejects.toThrow(
      /OPENAI_API_KEY/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on a non-200 response', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      response({error: 'rate limited'}, false, 429)
    );
    const adapter = new OpenAiAdapter({
      apiKey: 'k',
      model: 'gpt-test',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    });
    await expect(adapter.analyzeArticle(input)).rejects.toThrow(/429/);
  });

  it('throws when the response has no content', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      response({choices: [{message: {}}]})
    );
    const adapter = new OpenAiAdapter({
      apiKey: 'k',
      model: 'gpt-test',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    });
    await expect(adapter.analyzeArticle(input)).rejects.toThrow(
      /no message content/
    );
  });
});
