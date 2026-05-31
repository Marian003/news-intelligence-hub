import {AnthropicAdapter} from './anthropic.adapter';
import {FetchLike} from './http';
import {OpenAiAdapter} from './openai.adapter';
import type {LlmService} from './llm.types';

export interface LlmFactoryConfig {
  provider: 'openai' | 'anthropic';
  timeoutMs: number;
  openai: {apiKey: string; model: string; baseUrl?: string};
  anthropic: {apiKey: string; model: string; baseUrl?: string};
  /** Optional fetch override (tests). */
  fetchImpl?: FetchLike;
}

/**
 * Selects and constructs the active LLM adapter from config. Pure (no Nest, no
 * env access) so the selection is unit-testable and the module stays thin.
 */
export function createLlmService(config: LlmFactoryConfig): LlmService {
  switch (config.provider) {
    case 'openai':
      return new OpenAiAdapter({
        apiKey: config.openai.apiKey,
        model: config.openai.model,
        baseUrl: config.openai.baseUrl,
        timeoutMs: config.timeoutMs,
        fetchImpl: config.fetchImpl,
      });
    case 'anthropic':
      return new AnthropicAdapter({
        apiKey: config.anthropic.apiKey,
        model: config.anthropic.model,
        baseUrl: config.anthropic.baseUrl,
        timeoutMs: config.timeoutMs,
        fetchImpl: config.fetchImpl,
      });
    default:
      throw new Error(`Unknown LLM provider: ${String(config.provider)}`);
  }
}
