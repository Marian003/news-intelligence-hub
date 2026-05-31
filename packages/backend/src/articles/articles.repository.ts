import {Inject, Injectable} from '@nestjs/common';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {ArticleRow, NewArticleRow, articles} from '../database/schema';

/**
 * Data access for ingested articles. Like feeds, article rows are owned by a
 * user; query methods that the API adds later will be userId-scoped. The worker
 * uses {@link insertNew}, which relies on the (userId, normalizedUrl) unique
 * constraint to skip articles already seen — that is the URL-level dedup.
 */
@Injectable()
export class ArticlesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /**
   * Inserts the given rows, skipping any whose (userId, normalizedUrl) already
   * exists. Returns only the rows actually inserted, so the caller can report
   * how many were new.
   */
  async insertNew(rows: NewArticleRow[]): Promise<ArticleRow[]> {
    if (rows.length === 0) return [];
    return this.db
      .insert(articles)
      .values(rows)
      .onConflictDoNothing({
        target: [articles.userId, articles.normalizedUrl],
      })
      .returning();
  }
}
