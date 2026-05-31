import {Inject, Injectable} from '@nestjs/common';
import {eq} from 'drizzle-orm';
import {ExtractedEntity} from '../llm/llm.types';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {articleEntities} from '../database/schema';

/**
 * Per-article entity mentions. Replacing (delete + insert) on each processing
 * run keeps reprocessing idempotent — an article never accumulates stale or
 * duplicated mentions.
 */
@Injectable()
export class ArticleEntitiesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async replaceForArticle(
    articleId: string,
    userId: string,
    entities: ExtractedEntity[]
  ): Promise<void> {
    await this.db.transaction(async tx => {
      await tx
        .delete(articleEntities)
        .where(eq(articleEntities.articleId, articleId));
      if (entities.length > 0) {
        await tx.insert(articleEntities).values(
          entities.map(entity => ({
            articleId,
            userId,
            name: entity.name,
            type: entity.type,
          }))
        );
      }
    });
  }
}
