import {Inject, Injectable} from '@nestjs/common';
import {eq} from 'drizzle-orm';
import {Importance} from '@nih/shared';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {
  ArticleRow,
  ArticleStatusValue,
  NewArticleRow,
  articles,
} from '../database/schema';

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

  // --- System-level access used by the processing worker. ---

  async findById(id: string): Promise<ArticleRow | undefined> {
    const rows = await this.db
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);
    return rows[0];
  }

  async setStatus(id: string, status: ArticleStatusValue): Promise<void> {
    await this.db.update(articles).set({status}).where(eq(articles.id, id));
  }

  /** Stores the LLM markup and marks the article processed. */
  async saveProcessed(
    id: string,
    markup: {summary: string; importance: Importance}
  ): Promise<void> {
    await this.db
      .update(articles)
      .set({
        summary: markup.summary,
        importance: markup.importance,
        status: 'processed',
        processedAt: new Date(),
      })
      .where(eq(articles.id, id));
  }
}
