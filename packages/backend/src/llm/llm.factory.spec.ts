import {describe, expect, it} from 'vitest';
import {createLlmService, LlmFactoryConfig} from './llm.factory';

const base: LlmFactoryConfig = {
  provider: 'anthropic',
  timeoutMs: 1000,
  openai: {apiKey: 'a', model: 'gpt'},
  anthropic: {apiKey: 'b', model: 'claude'},
};

describe('createLlmService', () => {
  it('returns the OpenAI adapter for provider openai', () => {
    const service = createLlmService({...base, provider: 'openai'});
    expect(service.provider).toBe('openai');
    expect(service.model).toBe('gpt');
  });

  it('returns the Anthropic adapter for provider anthropic', () => {
    const service = createLlmService({...base, provider: 'anthropic'});
    expect(service.provider).toBe('anthropic');
    expect(service.model).toBe('claude');
  });

  it('throws on an unknown provider', () => {
    expect(() =>
      createLlmService({
        ...base,
        provider: 'gemini' as unknown as LlmFactoryConfig['provider'],
      })
    ).toThrow(/Unknown LLM provider/);
  });
});
