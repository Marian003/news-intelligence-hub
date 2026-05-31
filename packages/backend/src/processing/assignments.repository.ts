import {Inject, Injectable} from '@nestjs/common';
import {eq} from 'drizzle-orm';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {articleAxisValues, articleCategories} from '../database/schema';

/**
 * Stores the LLM's category and axis assignments for an article. Replace
 * semantics (delete + insert) keep reprocessing idempotent.
 */
@Injectable()
export class AssignmentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async replaceCategories(
    articleId: string,
    userId: string,
    categoryIds: string[]
  ): Promise<void> {
    await this.db.transaction(async tx => {
      await tx
        .delete(articleCategories)
        .where(eq(articleCategories.articleId, articleId));
      if (categoryIds.length > 0) {
        await tx
          .insert(articleCategories)
          .values(
            categoryIds.map(categoryId => ({articleId, categoryId, userId}))
          );
      }
    });
  }

  async replaceAxisValues(
    articleId: string,
    userId: string,
    entries: Array<{axisId: string; value: string}>
  ): Promise<void> {
    await this.db.transaction(async tx => {
      await tx
        .delete(articleAxisValues)
        .where(eq(articleAxisValues.articleId, articleId));
      if (entries.length > 0) {
        await tx
          .insert(articleAxisValues)
          .values(entries.map(entry => ({articleId, userId, ...entry})));
      }
    });
  }
}
