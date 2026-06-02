import {Logger} from '@nestjs/common';
import type {
  ArticleAnalysisInput,
  ArticleAnalysisResponse,
  DigestInput,
  DigestResponse,
  LlmService,
} from './llm.types';

/**
 * Wraps the configured providers and fails over: it tries the active adapter
 * first and, on error, the next one. This is the "degrade soft" half of the
 * reliability strategy (the "fail loud" half — timeout, validation, retry — lives
 * in the adapters and the worker). If every provider fails, the last error is
 * rethrown so BullMQ can retry the job.
 */
export class ResilientLlmService implements LlmService {
  private readonly logger = new Logger(ResilientLlmService.name);

  constructor(private readonly adapters: LlmService[]) {
    if (adapters.length === 0) {
      throw new Error('ResilientLlmService needs at least one adapter');
    }
  }

  get provider(): string {
    return this.adapters[0].provider;
  }

  get model(): string {
    return this.adapters[0].model;
  }

  analyzeArticle(
    input: ArticleAnalysisInput
  ): Promise<ArticleAnalysisResponse> {
    return this.withFailover(adapter => adapter.analyzeArticle(input));
  }

  buildDigest(input: DigestInput): Promise<DigestResponse> {
    return this.withFailover(adapter => adapter.buildDigest(input));
  }

  /** Runs `call` against each adapter in turn, failing over on error. */
  private async withFailover<T>(
    call: (adapter: LlmService) => Promise<T>
  ): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < this.adapters.length; i++) {
      const adapter = this.adapters[i];
      try {
        return await call(adapter);
      } catch (err) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        const next = this.adapters[i + 1];
        this.logger.warn(
          `Provider ${adapter.provider} failed (${message})` +
            (next ? `; failing over to ${next.provider}` : '; no fallback left')
        );
      }
    }
    throw lastError;
  }
}
