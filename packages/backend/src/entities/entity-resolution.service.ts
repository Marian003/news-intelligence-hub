import {Injectable} from '@nestjs/common';
import {NewArticleEntityRow} from '../database/schema';
import {ExtractedEntity} from '../llm/llm.types';
import {EntitiesRepository} from './entities.repository';
import {normalizeEntityName} from './entity-normalize';

/**
 * Resolves an article's extracted entity mentions to canonical entities and
 * records the article->entity links. Deterministic: each mention is normalized
 * to a key and find-or-created; differing surface forms of the same key collapse
 * into one entity and accumulate as aliases. No LLM call here — the merge is the
 * cheap step, run on every processed article (the incremental graph update).
 */
@Injectable()
export class EntityResolutionService {
  constructor(private readonly entities: EntitiesRepository) {}

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

      const entity = await this.entities.upsertCanonical(
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
}
