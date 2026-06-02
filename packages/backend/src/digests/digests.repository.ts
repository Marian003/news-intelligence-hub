import {Inject, Injectable} from '@nestjs/common';
import {and, desc, eq, gte, inArray, sql} from 'drizzle-orm';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {
  DigestResultData,
  DigestRow,
  articleCategories,
  articleEntities,
  articles,
  categories,
  digests,
  entities,
} from '../database/schema';

export type DigestPeriodValue = DigestRow['period'];

/** The deterministic aggregates over a period, before the LLM writes the prose. */
export interface DigestAggregates {
  topEntities: DigestResultData['topEntities'];
  topCategories: DigestResultData['topCategories'];
  keyArticles: DigestResultData['keyArticles'];
  articleCount: number;
}

// Highest-importance, then most-recent, articles surface as the "key" ones.
const IMPORTANCE_RANK = sql`case ${articles.importance}
  when 'high' then 0 when 'normal' then 1 else 2 end`;

/**
 * Data access for period digests: the digest rows themselves plus the
 * deterministic aggregation that feeds the LLM. All aggregation is SQL — the
 * model only writes the narrative (FR-11).
 */
@Injectable()
export class DigestsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async createPending(
    userId: string,
    period: DigestPeriodValue,
    categoryIds: string[],
    entityIds: string[]
  ): Promise<DigestRow> {
    const rows = await this.db
      .insert(digests)
      .values({userId, period, categoryIds, entityIds})
      .returning();
    return rows[0];
  }

  async findForUser(
    id: string,
    userId: string
  ): Promise<DigestRow | undefined> {
    const rows = await this.db
      .select()
      .from(digests)
      .where(and(eq(digests.id, id), eq(digests.userId, userId)))
      .limit(1);
    return rows[0];
  }

  async listForUser(userId: string): Promise<DigestRow[]> {
    return this.db
      .select()
      .from(digests)
      .where(eq(digests.userId, userId))
      .orderBy(desc(digests.createdAt))
      .limit(50);
  }

  /** Worker-side load (no user scope; the job id is the authority). */
  async findById(id: string): Promise<DigestRow | undefined> {
    const rows = await this.db
      .select()
      .from(digests)
      .where(eq(digests.id, id))
      .limit(1);
    return rows[0];
  }

  async markReady(id: string, result: DigestResultData): Promise<void> {
    await this.db
      .update(digests)
      .set({status: 'ready', result, completedAt: new Date()})
      .where(eq(digests.id, id));
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db
      .update(digests)
      .set({status: 'failed', error, completedAt: new Date()})
      .where(eq(digests.id, id));
  }

  /**
   * Computes the period aggregates for one user: the processed articles in the
   * window (optionally scoped to categories/entities), then their top entities,
   * top categories, and the key articles. Pure SQL, no LLM.
   */
  async aggregate(
    userId: string,
    since: number,
    categoryIds: string[],
    entityIds: string[]
  ): Promise<DigestAggregates> {
    const conditions = [
      eq(articles.userId, userId),
      eq(articles.status, 'processed'),
      gte(
        sql`coalesce(${articles.publishedAt}, ${articles.ingestedAt})`,
        sql`to_timestamp(${since})`
      ),
    ];
    if (categoryIds.length > 0) {
      conditions.push(
        inArray(
          articles.id,
          this.db
            .select({id: articleCategories.articleId})
            .from(articleCategories)
            .where(inArray(articleCategories.categoryId, categoryIds))
        )
      );
    }
    if (entityIds.length > 0) {
      conditions.push(
        inArray(
          articles.id,
          this.db
            .select({id: articleEntities.articleId})
            .from(articleEntities)
            .where(inArray(articleEntities.entityId, entityIds))
        )
      );
    }

    const matched = await this.db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        summary: articles.summary,
      })
      .from(articles)
      .where(and(...conditions))
      .orderBy(
        IMPORTANCE_RANK,
        desc(sql`coalesce(${articles.publishedAt}, ${articles.ingestedAt})`)
      );

    const ids = matched.map(row => row.id);
    if (ids.length === 0) {
      return {
        topEntities: [],
        topCategories: [],
        keyArticles: [],
        articleCount: 0,
      };
    }

    const [topEntities, topCategories] = await Promise.all([
      this.db
        .select({
          name: entities.canonicalName,
          type: entities.type,
          mentions: sql<number>`count(distinct ${articleEntities.articleId})::int`,
        })
        .from(articleEntities)
        .innerJoin(entities, eq(entities.id, articleEntities.entityId))
        .where(inArray(articleEntities.articleId, ids))
        .groupBy(entities.canonicalName, entities.type)
        .orderBy(desc(sql`count(distinct ${articleEntities.articleId})`))
        .limit(10),
      this.db
        .select({
          name: categories.name,
          articles: sql<number>`count(distinct ${articleCategories.articleId})::int`,
        })
        .from(articleCategories)
        .innerJoin(categories, eq(categories.id, articleCategories.categoryId))
        .where(inArray(articleCategories.articleId, ids))
        .groupBy(categories.name)
        .orderBy(desc(sql`count(distinct ${articleCategories.articleId})`))
        .limit(10),
    ]);

    return {
      topEntities,
      topCategories,
      keyArticles: matched.slice(0, 10),
      articleCount: matched.length,
    };
  }
}
