import {Inject, Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {LlmUsageRepository} from '../llm/llm-usage.repository';
import {LLM_SERVICE} from '../llm/llm.module';
import type {LlmService} from '../llm/llm.types';
import {DigestsRepository} from './digests.repository';

const PERIOD_SECONDS: Record<string, number> = {
  day: 86_400,
  week: 604_800,
  month: 2_592_000,
};

/**
 * Builds one digest end to end (FR-11): deterministic aggregation over the
 * period, then a single LLM call for the narrative. Runs in the worker via the
 * digest queue, so it never blocks HTTP. The LLM call is recorded under the
 * `digest` operation for telemetry.
 */
@Injectable()
export class DigestBuilderService {
  private readonly logger = new Logger(DigestBuilderService.name);

  constructor(
    private readonly digests: DigestsRepository,
    private readonly usage: LlmUsageRepository,
    private readonly config: ConfigService,
    @Inject(LLM_SERVICE) private readonly llm: LlmService
  ) {}

  async build(digestId: string): Promise<void> {
    const digest = await this.digests.findById(digestId);
    if (!digest) {
      this.logger.warn(`Build requested for missing digest ${digestId}`);
      return;
    }

    try {
      const since =
        Math.floor(Date.now() / 1000) - PERIOD_SECONDS[digest.period];
      const aggregates = await this.digests.aggregate(
        digest.userId,
        since,
        digest.categoryIds,
        digest.entityIds
      );

      const summary =
        aggregates.articleCount === 0
          ? 'No articles matched this period and selection.'
          : await this.writeSummary(digest.userId, digest.period, aggregates);

      await this.digests.markReady(digestId, {...aggregates, summary});
      this.logger.log(
        `Digest ${digestId} ready (${aggregates.articleCount} articles)`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.digests.markFailed(digestId, message);
      this.logger.error(`Digest ${digestId} failed: ${message}`);
      throw err;
    }
  }

  private async writeSummary(
    userId: string,
    period: 'day' | 'week' | 'month',
    aggregates: {
      topEntities: Array<{name: string}>;
      topCategories: Array<{name: string}>;
      keyArticles: Array<{title: string; summary: string | null}>;
    }
  ): Promise<string> {
    const response = await this.llm.buildDigest({
      period,
      topEntities: aggregates.topEntities.map(e => e.name),
      topCategories: aggregates.topCategories.map(c => c.name),
      articles: aggregates.keyArticles.map(a => ({
        title: a.title,
        summary: a.summary ?? '',
      })),
      maxTokens: this.config.getOrThrow<number>('LLM_MAX_TOKENS'),
    });

    await this.usage.record({
      userId,
      operation: 'digest',
      provider: response.provider,
      model: response.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
    });

    return response.result.summary;
  }
}
