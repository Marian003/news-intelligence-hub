import {Inject, Injectable} from '@nestjs/common';
import {and, desc, eq, gte, ilike, inArray, ne, sql} from 'drizzle-orm';
import {EntityType, Importance} from '@nih/shared';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {
  ArticleRow,
  ArticleStatusValue,
  NewArticleRow,
  articleAxisValues,
  articleCategories,
  articleEntities,
  articles,
  axes,
  categories,
  entities,
  feeds,
} from '../database/schema';

export interface ArticleListFilters {
  status?: ArticleStatusValue;
  feedId?: string;
  importance?: Importance;
  categoryId?: string;
  q?: string;
  since?: number; // Unix seconds; only articles at/after this time-window start.
  limit: number;
  offset: number;
}

export interface ArticleListItem {
  id: string;
  title: string;
  url: string;
  author: string | null;
  feedId: string | null;
  source: string | null; // feed title, or null once the feed is deleted
  status: ArticleStatusValue;
  importance: Importance | null;
  summary: string | null;
  publishedAt: number | null;
  ingestedAt: number;
  similarCount: number;
  categories: string[];
  entities: Array<{name: string; type: EntityType}>;
}

export interface ArticleCard extends Omit<ArticleListItem, 'entities'> {
  content: string | null;
  contentHash: string;
  entities: Array<{id: string; canonicalName: string; type: EntityType}>;
  axisValues: Array<{axis: string; value: string}>;
  similar: Array<{
    id: string;
    title: string;
    url: string;
    feedId: string | null;
  }>;
}

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

  /** Ids of a user's articles in a given status (used to drive regeneration). */
  async idsForUserByStatus(
    userId: string,
    status: ArticleStatusValue
  ): Promise<string[]> {
    const rows = await this.db
      .select({id: articles.id})
      .from(articles)
      .where(and(eq(articles.userId, userId), eq(articles.status, status)));
    return rows.map(row => row.id);
  }

  /** Moves a set of articles to a status in one statement (regeneration start). */
  async setStatusForIds(
    ids: string[],
    status: ArticleStatusValue
  ): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(articles)
      .set({status})
      .where(inArray(articles.id, ids));
  }

  async countForUserByStatus(
    userId: string,
    status: ArticleStatusValue
  ): Promise<number> {
    const rows = await this.db
      .select({count: sql<number>`count(*)::int`})
      .from(articles)
      .where(and(eq(articles.userId, userId), eq(articles.status, status)));
    return rows[0]?.count ?? 0;
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

  // --- Read (API), all userId-scoped. ---

  async listForUser(
    userId: string,
    filters: ArticleListFilters
  ): Promise<ArticleListItem[]> {
    const conditions = [eq(articles.userId, userId)];
    if (filters.status) conditions.push(eq(articles.status, filters.status));
    if (filters.feedId) conditions.push(eq(articles.feedId, filters.feedId));
    if (filters.importance) {
      conditions.push(eq(articles.importance, filters.importance));
    }
    if (filters.q) conditions.push(ilike(articles.title, `%${filters.q}%`));
    if (filters.since !== undefined) {
      conditions.push(
        gte(
          sql`coalesce(${articles.publishedAt}, ${articles.ingestedAt})`,
          sql`to_timestamp(${filters.since})`
        )
      );
    }
    if (filters.categoryId) {
      conditions.push(
        inArray(
          articles.id,
          this.db
            .select({id: articleCategories.articleId})
            .from(articleCategories)
            .where(eq(articleCategories.categoryId, filters.categoryId))
        )
      );
    }

    const rows = await this.db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        author: articles.author,
        feedId: articles.feedId,
        status: articles.status,
        importance: articles.importance,
        summary: articles.summary,
        publishedAt: articles.publishedAt,
        ingestedAt: articles.ingestedAt,
        contentHash: articles.contentHash,
        source: feeds.title,
      })
      .from(articles)
      .leftJoin(feeds, eq(feeds.id, articles.feedId))
      .where(and(...conditions))
      .orderBy(
        desc(sql`coalesce(${articles.publishedAt}, ${articles.ingestedAt})`)
      )
      .limit(filters.limit)
      .offset(filters.offset);

    if (rows.length === 0) return [];
    const ids = rows.map(r => r.id);
    const [categoryMap, entityMap, similarMap] = await Promise.all([
      this.categoriesByArticle(ids),
      this.entitiesByArticle(ids),
      this.similarCounts(
        userId,
        rows.map(r => r.contentHash)
      ),
    ]);

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      url: row.url,
      author: row.author,
      feedId: row.feedId,
      source: row.source,
      status: row.status,
      importance: row.importance,
      summary: row.summary,
      publishedAt: toUnix(row.publishedAt),
      ingestedAt: toUnix(row.ingestedAt) ?? 0,
      similarCount: Math.max(0, (similarMap.get(row.contentHash) ?? 1) - 1),
      categories: categoryMap.get(row.id) ?? [],
      entities: entityMap.get(row.id) ?? [],
    }));
  }

  async cardForUser(
    id: string,
    userId: string
  ): Promise<ArticleCard | undefined> {
    const rows = await this.db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.userId, userId)))
      .limit(1);
    const article = rows[0];
    if (!article) return undefined;

    const [source, entityRows, categoryRows, axisRows, similar] =
      await Promise.all([
        this.feedTitle(article.feedId),
        this.db
          .select({
            id: entities.id,
            canonicalName: entities.canonicalName,
            type: entities.type,
          })
          .from(articleEntities)
          .innerJoin(entities, eq(entities.id, articleEntities.entityId))
          .where(eq(articleEntities.articleId, id)),
        this.db
          .select({name: categories.name})
          .from(articleCategories)
          .innerJoin(
            categories,
            eq(categories.id, articleCategories.categoryId)
          )
          .where(eq(articleCategories.articleId, id)),
        this.db
          .select({axis: axes.name, value: articleAxisValues.value})
          .from(articleAxisValues)
          .innerJoin(axes, eq(axes.id, articleAxisValues.axisId))
          .where(eq(articleAxisValues.articleId, id)),
        this.db
          .select({
            id: articles.id,
            title: articles.title,
            url: articles.url,
            feedId: articles.feedId,
          })
          .from(articles)
          .where(
            and(
              eq(articles.userId, userId),
              eq(articles.contentHash, article.contentHash),
              ne(articles.id, id)
            )
          ),
      ]);

    return {
      id: article.id,
      title: article.title,
      url: article.url,
      author: article.author,
      feedId: article.feedId,
      source,
      status: article.status,
      importance: article.importance,
      summary: article.summary,
      publishedAt: toUnix(article.publishedAt),
      ingestedAt: toUnix(article.ingestedAt) ?? 0,
      content: article.content,
      contentHash: article.contentHash,
      categories: categoryRows.map(c => c.name),
      similarCount: similar.length,
      entities: entityRows,
      axisValues: axisRows,
      similar,
    };
  }

  private async categoriesByArticle(
    articleIds: string[]
  ): Promise<Map<string, string[]>> {
    const rows = await this.db
      .select({articleId: articleCategories.articleId, name: categories.name})
      .from(articleCategories)
      .innerJoin(categories, eq(categories.id, articleCategories.categoryId))
      .where(inArray(articleCategories.articleId, articleIds));
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.articleId) ?? [];
      list.push(row.name);
      map.set(row.articleId, list);
    }
    return map;
  }

  private async feedTitle(feedId: string | null): Promise<string | null> {
    if (!feedId) return null;
    const rows = await this.db
      .select({title: feeds.title})
      .from(feeds)
      .where(eq(feeds.id, feedId))
      .limit(1);
    return rows[0]?.title ?? null;
  }

  private async entitiesByArticle(
    articleIds: string[]
  ): Promise<Map<string, Array<{name: string; type: EntityType}>>> {
    const rows = await this.db
      .select({
        articleId: articleEntities.articleId,
        name: entities.canonicalName,
        type: entities.type,
      })
      .from(articleEntities)
      .innerJoin(entities, eq(entities.id, articleEntities.entityId))
      .where(inArray(articleEntities.articleId, articleIds));
    const map = new Map<string, Array<{name: string; type: EntityType}>>();
    for (const row of rows) {
      const list = map.get(row.articleId) ?? [];
      list.push({name: row.name, type: row.type});
      map.set(row.articleId, list);
    }
    return map;
  }

  private async similarCounts(
    userId: string,
    contentHashes: string[]
  ): Promise<Map<string, number>> {
    const unique = [...new Set(contentHashes)];
    if (unique.length === 0) return new Map();
    const rows = await this.db
      .select({
        hash: articles.contentHash,
        count: sql<number>`count(*)::int`,
      })
      .from(articles)
      .where(
        and(eq(articles.userId, userId), inArray(articles.contentHash, unique))
      )
      .groupBy(articles.contentHash);
    return new Map(rows.map(r => [r.hash, r.count]));
  }
}

function toUnix(date: Date | null): number | null {
  return date ? Math.floor(date.getTime() / 1000) : null;
}
