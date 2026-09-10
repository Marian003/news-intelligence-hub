import {AnthropicAdapter} from './anthropic.adapter';
import {FetchLike} from './http';
import {OpenAiAdapter} from './openai.adapter';
import {ResilientLlmService} from './resilient.llm';
import type {LlmService} from './llm.types';

export type LlmProvider = 'openai' | 'anthropic';

export interface LlmFactoryConfig {
  provider: LlmProvider;
  timeoutMs: number;
  openai: {apiKey: string; model: string; baseUrl?: string};
  anthropic: {apiKey: string; model: string; baseUrl?: string};
  /** Optional fetch override (tests). */
  fetchImpl?: FetchLike;
  /** Optional per-attempt observer, wired to the Prometheus counter. */
  onCall?: (provider: string, outcome: 'success' | 'failure') => void;
}

function buildAdapter(
  provider: LlmProvider,
  config: LlmFactoryConfig
): LlmService {
  if (provider === 'openai') {
    return new OpenAiAdapter({
      apiKey: config.openai.apiKey,
      model: config.openai.model,
      baseUrl: config.openai.baseUrl,
      timeoutMs: config.timeoutMs,
      fetchImpl: config.fetchImpl,
    });
  }
  return new AnthropicAdapter({
    apiKey: config.anthropic.apiKey,
    model: config.anthropic.model,
    baseUrl: config.anthropic.baseUrl,
    timeoutMs: config.timeoutMs,
    fetchImpl: config.fetchImpl,
  });
}

/**
 * Builds the single active LLM adapter from config. Pure (no Nest, no env), so
 * the selection is unit-testable.
 */
export function createLlmService(config: LlmFactoryConfig): LlmService {
  if (config.provider !== 'openai' && config.provider !== 'anthropic') {
    throw new Error(`Unknown LLM provider: ${String(config.provider)}`);
  }
  return buildAdapter(config.provider, config);
}

/**
 * Builds the active provider as primary, plus the other provider as a fallback
 * if it has an API key, wrapped so a failed call fails over (see ADR-4).
 */
export function createResilientLlmService(
  config: LlmFactoryConfig
): LlmService {
  const primary = createLlmService(config);
  const otherProvider: LlmProvider =
    config.provider === 'openai' ? 'anthropic' : 'openai';
  const otherKey =
    otherProvider === 'openai' ? config.openai.apiKey : config.anthropic.apiKey;

  const adapters = [primary];
  if (otherKey) {
    adapters.push(buildAdapter(otherProvider, config));
  }
  return new ResilientLlmService(adapters, config.onCall);
}
