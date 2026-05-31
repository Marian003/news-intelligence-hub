import {Global, Module, type Provider} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {createLlmService} from './llm.factory';
import type {LlmService} from './llm.types';

/** Injection token for the active {@link LlmService}. */
export const LLM_SERVICE = Symbol('LLM_SERVICE');

const llmProvider: Provider = {
  provide: LLM_SERVICE,
  inject: [ConfigService],
  useFactory: (config: ConfigService): LlmService =>
    createLlmService({
      provider: config.getOrThrow<'openai' | 'anthropic'>('LLM_PROVIDER'),
      timeoutMs: config.getOrThrow<number>('LLM_TIMEOUT_MS'),
      openai: {
        apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
        model: config.getOrThrow<string>('OPENAI_MODEL'),
        baseUrl: config.getOrThrow<string>('OPENAI_BASE_URL'),
      },
      anthropic: {
        apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY'),
        model: config.getOrThrow<string>('ANTHROPIC_MODEL'),
        baseUrl: config.getOrThrow<string>('ANTHROPIC_BASE_URL'),
      },
    }),
};

/**
 * Exposes the active LLM adapter (chosen by LLM_PROVIDER) behind {@link
 * LLM_SERVICE}. Global so the processing worker can inject it; the rest of the
 * app stays unaware of which provider is in use.
 */
@Global()
@Module({
  providers: [llmProvider],
  exports: [LLM_SERVICE],
})
export class LlmModule {}
