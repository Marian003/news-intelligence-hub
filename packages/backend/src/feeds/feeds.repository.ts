import {Inject, Injectable} from '@nestjs/common';
import {and, desc, eq} from 'drizzle-orm';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {FeedRow, NewFeedRow, feeds} from '../database/schema';

/** Fields the application (service or workers) may update on a feed. */
export type FeedPatch = Partial<
  Pick<FeedRow, 'title' | 'status' | 'lastError' | 'lastPolledAt'>
>;

/**
 * Data access for feeds. Every method that targets a specific feed takes the
 * owner's userId and includes it in the WHERE clause — this is where tenant
 * isolation is enforced, so one user can never read or mutate another's feed
 * even by guessing its id.
 */
@Injectable()
export class FeedsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async listByUser(userId: string): Promise<FeedRow[]> {
    return this.db
      .select()
      .from(feeds)
      .where(eq(feeds.userId, userId))
      .orderBy(desc(feeds.createdAt));
  }

  async findByIdForUser(
    id: string,
    userId: string
  ): Promise<FeedRow | undefined> {
    const rows = await this.db
      .select()
      .from(feeds)
      .where(and(eq(feeds.id, id), eq(feeds.userId, userId)))
      .limit(1);
    return rows[0];
  }

  async findByUrlForUser(
    url: string,
    userId: string
  ): Promise<FeedRow | undefined> {
    const rows = await this.db
      .select()
      .from(feeds)
      .where(and(eq(feeds.url, url), eq(feeds.userId, userId)))
      .limit(1);
    return rows[0];
  }

  async create(input: NewFeedRow): Promise<FeedRow> {
    const rows = await this.db.insert(feeds).values(input).returning();
    return rows[0];
  }

  async updateForUser(
    id: string,
    userId: string,
    patch: FeedPatch
  ): Promise<FeedRow | undefined> {
    const rows = await this.db
      .update(feeds)
      .set(patch)
      .where(and(eq(feeds.id, id), eq(feeds.userId, userId)))
      .returning();
    return rows[0];
  }

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(feeds)
      .where(and(eq(feeds.id, id), eq(feeds.userId, userId)))
      .returning({id: feeds.id});
    return rows.length > 0;
  }
}
