import {Inject, Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {ArticlesRepository} from '../articles/articles.repository';
import {EntityResolutionService} from '../entities/entity-resolution.service';
import {LlmCacheRepository} from '../llm/llm-cache.repository';
import {LlmUsageRepository} from '../llm/llm-usage.repository';
import {LLM_SERVICE} from '../llm/llm.module';
import type {ArticleAnalysisResult, LlmService} from '../llm/llm.types';
import {preFilter} from './pre-filter';

export type ProcessOutcome =
  | {status: 'skipped'}
  | {status: 'filtered'; reason: string}
  | {status: 'processed'; cached: boolean};

/**
 * Runs one article through the pipeline: pre-filter (deterministic, free) →
 * content-hash cache lookup → at most one LLM call → validate (in the adapter) →
 * persist markup + entity mentions. Caching and the pre-filter are the two cost
 * controls; a real provider call happens at most once per distinct content.
 */
@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    private readonly articles: ArticlesRepository,
    private readonly entityResolution: EntityResolutionService,
    private readonly cache: LlmCacheRepository,
    private readonly usage: LlmUsageRepository,
    private readonly config: ConfigService,
    @Inject(LLM_SERVICE) private readonly llm: LlmService
  ) {}

  async processArticle(articleId: string): Promise<ProcessOutcome> {
    const article = await this.articles.findById(articleId);
    if (!article) {
      this.logger.warn(`Process requested for missing article ${articleId}`);
      return {status: 'skipped'};
    }
    if (article.status === 'processed') {
      return {status: 'skipped'};
    }

    await this.articles.setStatus(article.id, 'processing');

    const verdict = preFilter(
      {content: article.content ?? ''},
      {
        minChars: this.config.getOrThrow<number>('PREFILTER_MIN_CHARS'),
        minWords: this.config.getOrThrow<number>('PREFILTER_MIN_WORDS'),
      }
    );
    if (!verdict.accepted) {
      await this.articles.setStatus(article.id, 'filtered');
      this.logger.log(
        `Article ${article.id} filtered (${verdict.reason}); no LLM call`
      );
      return {status: 'filtered', reason: verdict.reason ?? 'unknown'};
    }

    try {
      const {result, cached} = await this.analyze(article);
      await this.entityResolution.resolveForArticle(
        {id: article.id, userId: article.userId},
        result.entities
      );
      await this.articles.saveProcessed(article.id, {
        summary: result.summary,
        importance: result.importance,
      });
      this.logger.log(
        `Article ${article.id} processed (${cached ? 'cache hit' : 'LLM call'}): ` +
          `${result.importance}, ${result.entities.length} entities`
      );
      return {status: 'processed', cached};
    } catch (err) {
      await this.articles.setStatus(article.id, 'failed');
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Article ${article.id} processing failed: ${message}`);
      throw err;
    }
  }

  private async analyze(article: {
    id: string;
    userId: string;
    title: string;
    content: string | null;
    contentHash: string;
  }): Promise<{result: ArticleAnalysisResult; cached: boolean}> {
    const hit = await this.cache.get(article.contentHash);
    if (hit) {
      return {result: hit.result, cached: true};
    }

    const response = await this.llm.analyzeArticle({
      title: article.title,
      content: article.content ?? '',
      categories: [],
      axes: [],
      maxTokens: this.config.getOrThrow<number>('LLM_MAX_TOKENS'),
    });

    await this.cache.put({
      contentHash: article.contentHash,
      result: response.result,
      provider: response.provider,
      model: response.model,
    });
    await this.usage.record({
      userId: article.userId,
      articleId: article.id,
      operation: 'processing',
      provider: response.provider,
      model: response.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
    });

    return {result: response.result, cached: false};
  }
}
