import {Inject, Injectable} from '@nestjs/common';
import {and, eq, sql} from 'drizzle-orm';
import type {EntityType} from '@nih/shared';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {
  EntityRow,
  NewArticleEntityRow,
  articleEntities,
  entities,
} from '../database/schema';

/** A canonical entity enriched with read-time aggregates. */
export interface EntityListItem {
  id: string;
  canonicalName: string;
  type: EntityType;
  aliases: string[];
  description: string | null;
  mentionCount: number;
  firstSeen: number | null; // Unix seconds
  lastSeen: number | null;
}

export interface RelatedEntity {
  id: string;
  canonicalName: string;
  type: EntityType;
  weight: number; // articles this entity co-occurs with the subject in
}

export interface ActivityPoint {
  ts: number; // Unix seconds, day-truncated
  count: number;
}

export interface EntityCard extends EntityListItem {
  mentionArticleIds: string[];
  relatedEntities: RelatedEntity[];
  activity: ActivityPoint[];
}

@Injectable()
export class EntitiesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  // --- Resolution (worker) ---

  /** Find-or-create the canonical entity for a normalized key (race-safe). */
  async upsertCanonical(
    userId: string,
    type: EntityType,
    normalizedKey: string,
    canonicalName: string
  ): Promise<EntityRow> {
    const inserted = await this.db
      .insert(entities)
      .values({
        userId,
        type,
        normalizedKey,
        canonicalName,
        aliases: [canonicalName],
      })
      .onConflictDoNothing({
        target: [entities.userId, entities.type, entities.normalizedKey],
      })
      .returning();
    if (inserted[0]) return inserted[0];

    // Lost the race (or already existed): fetch the existing row.
    const existing = await this.db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.userId, userId),
          eq(entities.type, type),
          eq(entities.normalizedKey, normalizedKey)
        )
      )
      .limit(1);
    return existing[0];
  }

  /** Adds a surface form to the alias set if not already present. */
  async addAlias(
    id: string,
    aliases: string[],
    surface: string
  ): Promise<void> {
    if (aliases.includes(surface)) return;
    await this.db
      .update(entities)
      .set({aliases: [...aliases, surface]})
      .where(eq(entities.id, id));
  }

  /** Replaces an article's mention links (delete + insert) for idempotency. */
  async replaceLinks(
    articleId: string,
    links: NewArticleEntityRow[]
  ): Promise<void> {
    await this.db.transaction(async tx => {
      await tx
        .delete(articleEntities)
        .where(eq(articleEntities.articleId, articleId));
      if (links.length > 0) {
        await tx.insert(articleEntities).values(links);
      }
    });
  }

  // --- Read (API), all userId-scoped. Aggregates derived from mentions. ---

  async listForUser(userId: string): Promise<EntityListItem[]> {
    const result = await this.db.execute(sql`
      SELECT e.id, e.canonical_name, e.type, e.aliases, e.description,
             count(DISTINCT ae.article_id)::int AS mention_count,
             extract(epoch FROM min(coalesce(a.published_at, a.ingested_at)))::bigint AS first_seen,
             extract(epoch FROM max(coalesce(a.published_at, a.ingested_at)))::bigint AS last_seen
      FROM entities e
      LEFT JOIN article_entities ae ON ae.entity_id = e.id
      LEFT JOIN articles a ON a.id = ae.article_id
      WHERE e.user_id = ${userId}
      GROUP BY e.id
      ORDER BY mention_count DESC, e.canonical_name ASC
    `);
    return (result.rows as unknown as EntityAggRow[]).map(toListItem);
  }

  async findCardForUser(
    id: string,
    userId: string
  ): Promise<EntityCard | undefined> {
    const result = await this.db.execute(sql`
      SELECT e.id, e.canonical_name, e.type, e.aliases, e.description,
             count(DISTINCT ae.article_id)::int AS mention_count,
             extract(epoch FROM min(coalesce(a.published_at, a.ingested_at)))::bigint AS first_seen,
             extract(epoch FROM max(coalesce(a.published_at, a.ingested_at)))::bigint AS last_seen,
             coalesce(
               array_agg(DISTINCT ae.article_id) FILTER (WHERE ae.article_id IS NOT NULL),
               '{}'
             ) AS article_ids
      FROM entities e
      LEFT JOIN article_entities ae ON ae.entity_id = e.id
      LEFT JOIN articles a ON a.id = ae.article_id
      WHERE e.id = ${id} AND e.user_id = ${userId}
      GROUP BY e.id
      LIMIT 1
    `);
    const row = (
      result.rows as unknown as Array<EntityAggRow & {article_ids: string[]}>
    )[0];
    if (!row) return undefined;

    const [related, activity] = await Promise.all([
      this.relatedEntities(id, userId),
      this.activity(id, userId),
    ]);
    return {
      ...toListItem(row),
      mentionArticleIds: row.article_ids ?? [],
      relatedEntities: related,
      activity,
    };
  }

  /** Other entities co-mentioned with this one, ranked by shared-article count. */
  private async relatedEntities(
    id: string,
    userId: string
  ): Promise<RelatedEntity[]> {
    const result = await this.db.execute(sql`
      SELECT other.id, other.canonical_name, other.type,
             count(DISTINCT a.article_id)::int AS weight
      FROM article_entities a
      JOIN article_entities b
        ON b.article_id = a.article_id AND b.entity_id <> a.entity_id
      JOIN entities other ON other.id = b.entity_id
      WHERE a.entity_id = ${id} AND a.user_id = ${userId}
      GROUP BY other.id, other.canonical_name, other.type
      ORDER BY weight DESC, other.canonical_name ASC
      LIMIT 20
    `);
    return (
      result.rows as unknown as Array<{
        id: string;
        canonical_name: string;
        type: EntityType;
        weight: number;
      }>
    ).map(r => ({
      id: r.id,
      canonicalName: r.canonical_name,
      type: r.type,
      weight: Number(r.weight),
    }));
  }

  /** Day-by-day mention activity for the timeline chart. */
  private async activity(id: string, userId: string): Promise<ActivityPoint[]> {
    const result = await this.db.execute(sql`
      SELECT extract(epoch FROM date_trunc('day', coalesce(a.published_at, a.ingested_at)))::bigint AS ts,
             count(*)::int AS count
      FROM article_entities ae
      JOIN articles a ON a.id = ae.article_id
      WHERE ae.entity_id = ${id} AND ae.user_id = ${userId}
      GROUP BY 1
      ORDER BY 1 ASC
    `);
    return (result.rows as unknown as Array<{ts: string | null; count: number}>)
      .filter(r => r.ts !== null)
      .map(r => ({ts: Number(r.ts), count: Number(r.count)}));
  }
}

interface EntityAggRow {
  id: string;
  canonical_name: string;
  type: EntityType;
  aliases: string[];
  description: string | null;
  mention_count: number;
  first_seen: string | null;
  last_seen: string | null;
}

function toListItem(row: EntityAggRow): EntityListItem {
  return {
    id: row.id,
    canonicalName: row.canonical_name,
    type: row.type,
    aliases: row.aliases ?? [],
    description: row.description,
    mentionCount: Number(row.mention_count),
    firstSeen: row.first_seen === null ? null : Number(row.first_seen),
    lastSeen: row.last_seen === null ? null : Number(row.last_seen),
  };
}
