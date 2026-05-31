import {Inject, Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {ArticlesRepository} from '../articles/articles.repository';
import {AxesRepository} from '../axes/axes.repository';
import {CategoriesRepository} from '../categories/categories.repository';
import {AxisRow, CategoryRow} from '../database/schema';
import {EntityResolutionService} from '../entities/entity-resolution.service';
import {LlmCacheRepository} from '../llm/llm-cache.repository';
import {LlmUsageRepository} from '../llm/llm-usage.repository';
import {LLM_SERVICE} from '../llm/llm.module';
import type {
  ArticleAnalysisResult,
  AxisAssignment,
  LlmService,
} from '../llm/llm.types';
import {ProcessMode} from '../queue/queue.constants';
import {AssignmentsRepository} from './assignments.repository';
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
    private readonly categories: CategoriesRepository,
    private readonly axes: AxesRepository,
    private readonly assignments: AssignmentsRepository,
    private readonly cache: LlmCacheRepository,
    private readonly usage: LlmUsageRepository,
    private readonly config: ConfigService,
    @Inject(LLM_SERVICE) private readonly llm: LlmService
  ) {}

  async processArticle(
    articleId: string,
    mode: ProcessMode = 'processing'
  ): Promise<ProcessOutcome> {
    const article = await this.articles.findById(articleId);
    if (!article) {
      this.logger.warn(`Process requested for missing article ${articleId}`);
      return {status: 'skipped'};
    }
    // First-pass processing is idempotent (skip if already done); regeneration
    // deliberately re-analyzes a processed article under the new axis set.
    if (mode === 'processing' && article.status === 'processed') {
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
      // The user's catalog is sent to the model (on a cache miss) and used to map
      // the returned category/axis names back to this user's own ids.
      const userCategories = await this.categories.listByUser(article.userId);
      const userAxes = await this.axes.listByUser(article.userId);

      const {result, cached} = await this.analyze(
        article,
        userCategories,
        userAxes,
        mode
      );
      await this.entityResolution.resolveForArticle(
        {id: article.id, userId: article.userId},
        result.entities
      );
      await this.assignments.replaceCategories(
        article.id,
        article.userId,
        mapCategoryIds(result.categories, userCategories)
      );
      await this.assignments.replaceAxisValues(
        article.id,
        article.userId,
        mapAxisValues(result.axes, userAxes)
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

  private async analyze(
    article: {
      id: string;
      userId: string;
      title: string;
      content: string | null;
      contentHash: string;
    },
    userCategories: CategoryRow[],
    userAxes: AxisRow[],
    mode: ProcessMode
  ): Promise<{result: ArticleAnalysisResult; cached: boolean}> {
    // Regeneration bypasses the content cache: axis/category classification is
    // catalog-dependent, so the cached (content-only) result would be stale.
    if (mode !== 'regeneration') {
      const hit = await this.cache.get(article.contentHash);
      if (hit) {
        return {result: hit.result, cached: true};
      }
    }

    const response = await this.llm.analyzeArticle({
      title: article.title,
      content: article.content ?? '',
      categories: userCategories.map(c => ({name: c.name})),
      axes: userAxes.map(a => ({name: a.name, values: a.values})),
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
      operation: mode,
      provider: response.provider,
      model: response.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
    });

    return {result: response.result, cached: false};
  }
}

/** Maps category names the model returned to this user's category ids (by name). */
function mapCategoryIds(
  names: string[],
  userCategories: CategoryRow[]
): string[] {
  const byName = new Map(userCategories.map(c => [c.name.toLowerCase(), c.id]));
  const ids = new Set<string>();
  for (const name of names) {
    const id = byName.get(name.toLowerCase());
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * Maps the model's axis assignments to this user's axes, keeping only values
 * that are actually allowed on the matched axis (one value per axis).
 */
function mapAxisValues(
  assignments: AxisAssignment[],
  userAxes: AxisRow[]
): Array<{axisId: string; value: string}> {
  const byName = new Map(userAxes.map(a => [a.name.toLowerCase(), a]));
  const out: Array<{axisId: string; value: string}> = [];
  const used = new Set<string>();
  for (const {axis, value} of assignments) {
    const match = byName.get(axis.toLowerCase());
    if (!match || used.has(match.id)) continue;
    const allowed = match.values.find(
      v => v.toLowerCase() === value.toLowerCase()
    );
    if (allowed) {
      out.push({axisId: match.id, value: allowed});
      used.add(match.id);
    }
  }
  return out;
}
