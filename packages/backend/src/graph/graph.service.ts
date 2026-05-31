import {Inject, Injectable} from '@nestjs/common';
import {and, desc, eq, inArray, sql} from 'drizzle-orm';
import type {GraphEdge, GraphNode, GraphPayload, Importance} from '@nih/shared';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {articleEntities, articles, entities} from '../database/schema';

export interface GraphQuery {
  nodeTypes: Array<'article' | 'entity'>;
  importance?: Importance[];
  limit: number;
}

/**
 * Builds the react-flow graph payload for one user from the relational data.
 * Because it is derived on read, every newly-processed article (a new mention
 * row) is already reflected — there is no separate graph to recompute. Scoped to
 * the most recent processed articles to stay responsive at MVP scale.
 */
@Injectable()
export class GraphService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async buildGraph(userId: string, query: GraphQuery): Promise<GraphPayload> {
    const articleRows = await this.db
      .select({
        id: articles.id,
        title: articles.title,
        importance: articles.importance,
        publishedAt: articles.publishedAt,
        ingestedAt: articles.ingestedAt,
      })
      .from(articles)
      .where(
        and(
          eq(articles.userId, userId),
          eq(articles.status, 'processed'),
          query.importance
            ? inArray(articles.importance, query.importance)
            : undefined
        )
      )
      .orderBy(
        desc(sql`coalesce(${articles.publishedAt}, ${articles.ingestedAt})`)
      )
      .limit(query.limit);

    if (articleRows.length === 0) return {nodes: [], edges: []};
    const articleIds = articleRows.map(row => row.id);

    const mentionRows = await this.db
      .select({
        articleId: articleEntities.articleId,
        entityId: articleEntities.entityId,
        name: entities.canonicalName,
        type: entities.type,
      })
      .from(articleEntities)
      .innerJoin(entities, eq(entities.id, articleEntities.entityId))
      .where(
        and(
          eq(articleEntities.userId, userId),
          inArray(articleEntities.articleId, articleIds)
        )
      );

    const includeArticles = query.nodeTypes.includes('article');
    const includeEntities = query.nodeTypes.includes('entity');

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    if (includeArticles) {
      for (const row of articleRows) {
        const date = row.publishedAt ?? row.ingestedAt;
        nodes.push({
          id: row.id,
          kind: 'article',
          label: row.title,
          ts: date ? Math.floor(date.getTime() / 1000) : null,
          importance: row.importance,
        });
      }
    }

    if (includeEntities) {
      const seen = new Map<string, {name: string; type: GraphNode['kind']}>();
      for (const row of mentionRows) {
        if (!seen.has(row.entityId)) {
          seen.set(row.entityId, {name: row.name, type: 'entity'});
          nodes.push({
            id: row.entityId,
            kind: 'entity',
            label: row.name,
            entityType: row.type,
          });
        }
      }
    }

    // mentions edges only make sense when both endpoint kinds are shown.
    if (includeArticles && includeEntities) {
      for (const row of mentionRows) {
        edges.push({from: row.articleId, to: row.entityId, kind: 'mentions'});
      }
    }

    if (includeEntities) {
      edges.push(...coMentionEdges(mentionRows));
    }

    return {nodes, edges};
  }
}

/**
 * Derives entity<->entity co_mention edges from the mention list: for each
 * article, every unordered pair of distinct entities it mentions contributes to
 * that pair's weight (the number of articles they co-occur in).
 */
function coMentionEdges(
  mentions: Array<{articleId: string; entityId: string}>
): GraphEdge[] {
  const byArticle = new Map<string, Set<string>>();
  for (const {articleId, entityId} of mentions) {
    const set = byArticle.get(articleId) ?? new Set<string>();
    set.add(entityId);
    byArticle.set(articleId, set);
  }

  const weights = new Map<string, number>();
  for (const set of byArticle.values()) {
    const ids = [...set].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}|${ids[j]}`;
        weights.set(key, (weights.get(key) ?? 0) + 1);
      }
    }
  }

  return [...weights.entries()].map(([key, weight]) => {
    const [from, to] = key.split('|');
    return {from, to, kind: 'co_mention', weight};
  });
}
