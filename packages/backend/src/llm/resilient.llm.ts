import {Logger} from '@nestjs/common';
import type {
  ArticleAnalysisInput,
  ArticleAnalysisResponse,
  DigestInput,
  DigestResponse,
  EntityMatchInput,
  EntityMatchResponse,
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

  /**
   * @param adapters Providers in priority order.
   * @param onCall Optional observer invoked once per provider attempt with its
   *   outcome. Kept as a plain callback rather than an injected metrics service
   *   so this class stays free of Nest and framework-less in its unit tests;
   *   the module wires it to the Prometheus counter.
   */
  constructor(
    private readonly adapters: LlmService[],
    private readonly onCall?: (
      provider: string,
      outcome: 'success' | 'failure'
    ) => void
  ) {
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

  matchEntities(input: EntityMatchInput): Promise<EntityMatchResponse> {
    return this.withFailover(adapter => adapter.matchEntities(input));
  }

  /** Runs `call` against each adapter in turn, failing over on error. */
  private async withFailover<T>(
    call: (adapter: LlmService) => Promise<T>
  ): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < this.adapters.length; i++) {
      const adapter = this.adapters[i];
      try {
        const result = await call(adapter);
        this.onCall?.(adapter.provider, 'success');
        return result;
      } catch (err) {
        this.onCall?.(adapter.provider, 'failure');
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
