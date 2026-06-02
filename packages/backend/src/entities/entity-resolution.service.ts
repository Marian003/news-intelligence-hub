import {Inject, Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import type {EntityType} from '@nih/shared';
import {EntityRow, NewArticleEntityRow} from '../database/schema';
import {LlmUsageRepository} from '../llm/llm-usage.repository';
import {LLM_SERVICE} from '../llm/llm.module';
import type {ExtractedEntity, LlmService} from '../llm/llm.types';
import {EntitiesRepository} from './entities.repository';
import {normalizeEntityName} from './entity-normalize';

/**
 * Resolves an article's extracted entity mentions to canonical entities and
 * records the article->entity links.
 *
 * The first, deterministic pass normalizes each mention to a key and
 * find-or-creates it, so differing surface forms of the same key collapse with
 * zero LLM cost. When LLM_ENTITY_MATCHING is on, a surface form that the key
 * cannot merge (MSFT, a transliteration) gets one fuzzy-match call against the
 * existing entities of its type (FR-6); the decision is cached as an alias key,
 * so each novel form is matched at most once and cost stays bounded (FR-10).
 */
@Injectable()
export class EntityResolutionService {
  private readonly logger = new Logger(EntityResolutionService.name);
  private readonly matchingEnabled: boolean;
  private readonly maxCandidates: number;
  private readonly maxTokens: number;

  constructor(
    private readonly entities: EntitiesRepository,
    private readonly usage: LlmUsageRepository,
    private readonly config: ConfigService,
    @Inject(LLM_SERVICE) private readonly llm: LlmService
  ) {
    this.matchingEnabled = config.getOrThrow<boolean>('LLM_ENTITY_MATCHING');
    this.maxCandidates = config.getOrThrow<number>(
      'ENTITY_MATCH_MAX_CANDIDATES'
    );
    this.maxTokens = config.getOrThrow<number>('LLM_MAX_TOKENS');
  }

  async resolveForArticle(
    article: {id: string; userId: string},
    mentions: ExtractedEntity[]
  ): Promise<void> {
    // One link per distinct (type, key) so a name repeated in the article does
    // not inflate co-mention weights.
    const links = new Map<string, NewArticleEntityRow>();

    for (const mention of mentions) {
      const key = normalizeEntityName(mention.name);
      if (key.length === 0) continue;

      const entity = await this.resolveEntity(
        article.userId,
        mention.type,
        key,
        mention.name
      );
      await this.entities.addAlias(entity.id, entity.aliases, mention.name);

      links.set(`${mention.type}:${key}`, {
        articleId: article.id,
        userId: article.userId,
        entityId: entity.id,
        name: mention.name,
        type: mention.type,
      });
    }

    await this.entities.replaceLinks(article.id, [...links.values()]);
  }

  /** Deterministic key match, then cached/LLM fuzzy match, then create. */
  private async resolveEntity(
    userId: string,
    type: EntityType,
    key: string,
    surface: string
  ): Promise<EntityRow> {
    const byKey = await this.entities.findByKey(userId, type, key);
    if (byKey) return byKey;

    if (this.matchingEnabled) {
      const cached = await this.entities.findByAliasKey(userId, type, key);
      if (cached) return cached;

      const matched = await this.fuzzyMatch(userId, type, key, surface);
      if (matched) return matched;
    }

    return this.entities.upsertCanonical(userId, type, key, surface);
  }

  /** One bounded LLM match against existing entities; caches the verdict. */
  private async fuzzyMatch(
    userId: string,
    type: EntityType,
    key: string,
    surface: string
  ): Promise<EntityRow | undefined> {
    const candidates = await this.entities.candidatesForType(
      userId,
      type,
      this.maxCandidates
    );
    if (candidates.length === 0) return undefined;

    const response = await this.llm.matchEntities({
      name: surface,
      type,
      candidates,
      maxTokens: this.maxTokens,
    });
    await this.usage.record({
      userId,
      operation: 'entity_match',
      provider: response.provider,
      model: response.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
    });

    const {matchId} = response.result;
    // Guard against a hallucinated id: only accept one we actually offered.
    if (!matchId || !candidates.some(c => c.id === matchId)) return undefined;

    const entity = await this.entities.findById(matchId);
    if (!entity) return undefined;

    await this.entities.addAliasKey(userId, type, key, entity.id);
    this.logger.log(
      `Matched "${surface}" -> ${entity.canonicalName} (${type})`
    );
    return entity;
  }
}
